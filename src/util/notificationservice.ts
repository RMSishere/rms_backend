import admin from '../../firebase-admin';  // Import Firebase Admin SDK
import { User } from '../../src/users/users.schema';  // Make sure User is correctly exported
import { Notification } from '../../src/notification/notification.schema';  // Make sure Notification is correctly exported


// Utility function to send push notifications
const sendPushNotification = async (tokens: string[], title: string, body: string): Promise<void> => {
  const message = {
    notification: {
      title: title,
      body: body,
    },
    tokens: tokens,  // Array of device tokens of users
  };

  try {
    const response = await admin.messaging().sendMulticast(message);
    console.log('Successfully sent message:', response);
  } catch (error) {
    console.error('Error sending message:', error);
  }
};

// Utility to check whether notifications should be suppressed based on time or event
const shouldSuppressNotification = async (userId: string, eventType: string): Promise<boolean> => {
  // Implement suppression logic (e.g., check if user posted a request in the last 10 minutes)
  const user = await User.findById(userId);
  if (eventType === 'user_sign_up' && user?.lastRequestTime && new Date().getTime() - user.lastRequestTime.getTime() < 10 * 60 * 1000) {
    return true;  // Suppress if a request was posted within the last 10 minutes
  }
  return false;
};

// Utility to check for frequency caps (max 3 notifications per 7 days)
const checkFrequencyCap = async (userId: string): Promise<boolean> => {
  const notifications = await Notification.find({ recipient: userId });
  const recentNotifications = notifications.filter(notification => {
    return new Date().getTime() - notification.createdAt.getTime() < 7 * 24 * 60 * 60 * 1000; // Last 7 days
  });
  return recentNotifications.length < 3;  // Max 3 notifications in the last 7 days
};

// Function to send welcome notification
const sendWelcomeNotification = async (user: any): Promise<void> => {
  const title = "Welcome to RunMySale";
  const body = "Find help fast. Post your first request in under a minute.";

  if (user.devices && user.devices.length > 0) {
    const tokens = user.devices.map((device: any) => device.token);
    if (!(await shouldSuppressNotification(user._id, 'user_sign_up'))) {
      await sendPushNotification(tokens, title, body);
    }
  }
};

// Function to send first request nudge (24 hours after sign up)
const sendFirstRequestNudge = async (user: any): Promise<void> => {
  const title = "Ready when you are";
  const body = "Post your first request and let local affiliates do the heavy lifting.";

  if (user.devices && user.devices.length > 0) {
    const tokens = user.devices.map((device: any) => device.token);
    await sendPushNotification(tokens, title, body);
    // Repeat once at 72 hours if no request
    setTimeout(() => sendFirstRequestNudge(user), 72 * 60 * 60 * 1000);  // 72 hours
  }
};

// Function to send top-rated affiliate viewed job notification
const sendTopRatedAffiliateViewedJob = async (user: any, affiliateName: string): Promise<void> => {
  const title = "A top-rated affiliate viewed your job";
  const body = `${affiliateName} looked at your request. Quotes usually follow soon.`;

  if (user.devices && user.devices.length > 0) {
    const tokens = user.devices.map((device: any) => device.token);
    await sendPushNotification(tokens, title, body);
  }
};

// Function to send a proposal notification when a new proposal is submitted
const sendNewProposalNotification = async (user: any, affiliateName: string, serviceType: string): Promise<void> => {
  const title = "You have a new quote";
  const body = `Review ${affiliateName}'s quote for your ${serviceType} and book.`;

  if (user.devices && user.devices.length > 0) {
    const tokens = user.devices.map((device: any) => device.token);
    await sendPushNotification(tokens, title, body);
  }
};

// Function to send an appointment scheduled notification
const sendAppointmentScheduledNotification = async (user: any, serviceType: string, date: string, time: string): Promise<void> => {
  const title = "You’re scheduled";
  const body = `Your ${serviceType} is set for ${date} at ${time}.`;

  if (user.devices && user.devices.length > 0) {
    const tokens = user.devices.map((device: any) => device.token);
    await sendPushNotification(tokens, title, body);
  }
};

// Function to send appointment reminder 24 hours before
const sendAppointmentReminder24h = async (user: any, serviceType: string, time: string): Promise<void> => {
  const title = "Reminder for tomorrow";
  const body = `Your ${serviceType} is tomorrow at ${time}.`;

  if (user.devices && user.devices.length > 0) {
    const tokens = user.devices.map((device: any) => device.token);
    await sendPushNotification(tokens, title, body);
  }
};

// Function to send appointment reminder on the day of the appointment (3 hours before)
const sendAppointmentReminderDayOf = async (user: any, serviceType: string, time: string): Promise<void> => {
  const title = "Today’s the day";
  const body = `Your ${serviceType} is at ${time}.`;

  if (user.devices && user.devices.length > 0) {
    const tokens = user.devices.map((device: any) => device.token);
    await sendPushNotification(tokens, title, body);
  }
};

// Function to send rating request notification after job completion
const sendJobCompletedNotification = async (user: any, affiliateName: string): Promise<void> => {
  const title = "How did it go";
  const body = `Rate your experience with ${affiliateName}.`;

  if (user.devices && user.devices.length > 0) {
    const tokens = user.devices.map((device: any) => device.token);
    await sendPushNotification(tokens, title, body);
  }
};

// Function to send rating follow-up notification (only if no internal rating yet)
const sendRatingFollowUp = async (user: any, affiliateName: string): Promise<void> => {
  const title = "Share a quick rating";
  const body = `Your feedback helps keep quality high. Rate ${affiliateName} now.`;

  if (user.devices && user.devices.length > 0) {
    const tokens = user.devices.map((device: any) => device.token);
    await sendPushNotification(tokens, title, body);
    setTimeout(() => sendRatingFollowUp(user, affiliateName), 72 * 60 * 60 * 1000);  // Repeat after 72 hours
  }
};

// Function to send app-store review invite (only if internal rating ≥ 4)
const sendAppStoreReviewInvite = async (user: any): Promise<void> => {
  const title = "Thanks for your feedback";
  const body = "Mind sharing a quick review on the app store?";

  if (user.devices && user.devices.length > 0) {
    const tokens = user.devices.map((device: any) => device.token);
    await sendPushNotification(tokens, title, body);
  }
};

// Function to send re-engagement notifications for customers or affiliates
const sendReEngagementNotification = async (user: any, lastActivityTime: Date): Promise<void> => {
  const timeInactive = new Date().getTime() - new Date(lastActivityTime).getTime();

  let title: string, body: string;
  if (timeInactive >= 30 * 24 * 60 * 60 * 1000) { // 30 days
    title = "We’re still here to help";
    body = "New affiliates are available near you. Post a request today.";
  } else if (timeInactive >= 14 * 24 * 60 * 60 * 1000) { // 14 days
    title = "Need help again";
    body = "Post a request and let trusted affiliates handle the rest.";
  }

  if (user.devices && user.devices.length > 0) {
    const tokens = user.devices.map((device: any) => device.token);
    await sendPushNotification(tokens, title, body);
  }
};

// Admin notifications

// Function to notify admins when a user searches in an empty market (no affiliates in zip)
const sendAdminNoAffiliatesNotification = async (zipCode: string): Promise<void> => {
  const title = "No affiliates in " + zipCode;
  const body = `A user searched ${zipCode}. Consider recruiting.`;

  // Notify admins (assuming you have an admin users model)
  const adminUsers = await User.find({ role: 'admin' });
  const tokens = adminUsers.map(admin => admin.devices.map(device => device.token)).flat();
  if (tokens.length > 0) {
    await sendPushNotification(tokens, title, body);
  }
};

// Function to send an admin help message alert
const sendAdminHelpMessageAlert = async (user: any): Promise<void> => {
  const title = "New help request";
  const body = `From ${user.firstName} ${user.lastName}. Tap to view details.`;

  // Notify admins (assuming you have an admin users model)
  const adminUsers = await User.find({ role: 'admin' });
  const tokens = adminUsers.map(admin => admin.devices.map(device => device.token)).flat();
  if (tokens.length > 0) {
    await sendPushNotification(tokens, title, body);
  }
};

// Function to notify affiliate of a new job in their area
const sendNewJobInAreaNotification = async (affiliate: any, serviceType: string): Promise<void> => {
  const title = "New job available";
  const body = `${serviceType} near you. Open to view and quote.`;

  if (affiliate.devices && affiliate.devices.length > 0) {
    const tokens = affiliate.devices.map((device: any) => device.token);
    await sendPushNotification(tokens, title, body);
  }
};

// Function to notify affiliate when hired
const sendYoureHiredNotification = async (affiliate: any, serviceType: string, date: string, time: string): Promise<void> => {
  const title = "You’re hired";
  const body = `Confirm details and get ready for ${serviceType} on ${date} at ${time}.`;

  if (affiliate.devices && affiliate.devices.length > 0) {
    const tokens = affiliate.devices.map((device: any) => device.token);
    await sendPushNotification(tokens, title, body);
  }
};

// Function to send payment received notification
const sendPaymentReceivedNotification = async (affiliate: any, jobId: string): Promise<void> => {
  const title = "Payment received";
  const body = `Job #${jobId} is complete. Funds are on the way.`;

  if (affiliate.devices && affiliate.devices.length > 0) {
    const tokens = affiliate.devices.map((device: any) => device.token);
    await sendPushNotification(tokens, title, body);
  }
};

// Function to send weekly performance summary for affiliates
const sendWeeklyPerformanceSummary = async (affiliate: any): Promise<void> => {
  const title = "Your week at a glance";
  const body = `[Jobs Completed]: [N]. Avg rating: [R]. New leads: [L].`;  // Replace with actual data

  if (affiliate.devices && affiliate.devices.length > 0) {
    const tokens = affiliate.devices.map((device: any) => device.token);
    await sendPushNotification(tokens, title, body);
  }
};

// Example usage: Calling the function based on an event trigger
const triggerPushNotification = async (user: any, eventType: string): Promise<void> => {
  switch (eventType) {
    case 'user_sign_up':
      await sendWelcomeNotification(user);
      break;
    case 'no_service_request_created':
      await sendFirstRequestNudge(user);
      break;
    case 'affiliate_submitted_proposal':
      await sendNewProposalNotification(user, 'John Doe', 'Pressure Wash');
      break;
    case 'appointment_created':
      await sendAppointmentScheduledNotification(user, 'Move', '2025-12-15', '10:00 AM');
      break;
    case 'job_marked_complete':
      await sendJobCompletedNotification(user, 'Jane Doe');
      break;
    case 'rating_follow_up':
      await sendRatingFollowUp(user, 'Jane Doe');
      break;
    case 'app_store_review_invite':
      await sendAppStoreReviewInvite(user);
      break;
    case 'inactive_re_engagement':
      await sendReEngagementNotification(user, user.lastActivityAt);
      break;
    case 'admin_no_affiliates':
      await sendAdminNoAffiliatesNotification(user.zipCode);
      break;
    case 'help_ticket_created':
      await sendAdminHelpMessageAlert(user);
      break;
    case 'new_job_in_area':
      await sendNewJobInAreaNotification(user, 'Pressure Wash');
      break;
    case 'youre_hired':
      await sendYoureHiredNotification(user, 'Move', '2025-12-15', '10:00 AM');
      break;
    case 'payment_received':
      await sendPaymentReceivedNotification(user, '12345');
      break;
    case 'weekly_performance_summary':
      await sendWeeklyPerformanceSummary(user);
      break;
    default:
      console.log("No notification triggered for this event");
  }
};

// Export the function for use in controllers or services
export {
  sendPushNotification,
  sendWelcomeNotification,
  sendFirstRequestNudge,
  sendNewProposalNotification,
  sendAppointmentScheduledNotification,
  sendAppointmentReminder24h,
  sendAppointmentReminderDayOf,
  sendJobCompletedNotification,
  sendReEngagementNotification,
  sendAdminNoAffiliatesNotification,
  sendAdminHelpMessageAlert,
  sendNewJobInAreaNotification,
  sendYoureHiredNotification,
  sendPaymentReceivedNotification,
  sendWeeklyPerformanceSummary,
  triggerPushNotification,
};
