export const SERVICES = {
  SELL: {
    label: 'Selling Items',
    type: 'SELL',
    howSoonLabel: 'How Soon Do You Need It?',
    requestDetailProps: [
      'zip',
      'deliveryTime',
      'whereToSell',
      'noOfItems',
      'typeOfItems',
      'itemsSizes',
      'itemQualities',
      'itemlocation',
      'images',
      'videos',
      'remark',
      'items',
    ],
    reminderMailTemplatesData: {
      twoWeeksBefore: {
        info: 'This email is to remind you that your appointment in regards to us selling your items is coming up in 2 weeks on',
        subject: "Your Sale is 2 Weeks Away"
      },
      oneWeekBefore: {
        info: 'This email is to remind you that your appointment in regards to us selling your items is coming up in 1 week on',
        subject: 'Your sale… 1 more week'
      },
      onAppointmentDate: {
        info: 'This email is to remind you that your appointment in regards to us selling your items is coming up in less than 24 hours on',
        subject: 'Reminder: Less than 24 hours away...'
      }
    }
  },

  REMOVE: {
    label: 'Removing Items',
    type: 'REMOVE',
    howSoonLabel: 'How Soon Do You Need It?',
    requestDetailProps: [
      'zip',
      'deliveryTime',
      'noOfItems',
      'typeOfItems',
      'itemsSizes',
      'itemlocation',
      'images',
      'videos',
      'remark',
    ],
    reminderMailTemplatesData: {
      twoWeeksBefore: {
        info: 'This email is to remind you that your appointment in regards to us removing your items is coming up in 2 weeks on',
        subject: "Your Item Removal is 2 Weeks Away"
      },
      oneWeekBefore: {
        info: 'This email is to remind you that your appointment in regards to us removing your items is coming up in 1 week on',
        subject: 'Your item removal… 1 more week'
      },
      onAppointmentDate: {
        info: 'This email is to remind you that your appointment in regards to us removing your items is coming up in less than 24 hours on',
        subject: 'Reminder: Less than 24 hours away...'
      }
    }
  },
  MOVE: {
    label: 'Moving Items',
    type: 'MOVE',
    howSoonLabel: 'How Soon Do You Need To Move?',
    requestDetailProps: [
      'zip',
      'deliveryTime',
      'state',
      'city',
      'movingFrom',
      'movingFromFloor',
      'movingTo',
      'movingToFloor',
      'itemsWeight',
      'images',
      'videos',
      'remark',
    ],
    reminderMailTemplatesData: {
      twoWeeksBefore: {
        info: 'This email is to remind you that your appointment in regards to us moving your items is coming up in 2 weeks on',
        subject: "Your Move is 2 Weeks Away"
      },
      oneWeekBefore: {
        info: 'This email is to remind you that your appointment in regards to us moving your items is coming up in 1 week on',
        subject: 'Your move… 1 more week'
      },
      onAppointmentDate: {
        info: 'This email is to remind you that your appointment in regards to us moving your items is coming up in less than 24 hours on',
        subject: 'Reminder: Less than 24 hours away...'
      }
    }
  },
  REALTOR: {
    label: 'Realtor',
    type: 'REALTOR',
    howSoonLabel: 'How Soon Do You Need A Realtor?',
    requestDetailProps: ['zip', 'deliveryTime', 'needRealtor', 'remark'],
    reminderMailTemplatesData: {
      twoWeeksBefore: {
        info: 'This email is to remind you that your appointment in regards to your real estate needs is coming up in 2 weeks on',
        subject: "Your appointment with Realtor is 2 Weeks Away"
      },
      oneWeekBefore: {
        info: 'This email is to remind you that your appointment in regards to your real estate needs is coming up in 1 week on',
        subject: 'Your appointment with Realtor… 1 more week'
      },
      onAppointmentDate: {
        info: 'TThis email is to remind you that your appointment in regards to your real estate needs is coming up in less than 24 hours on',
        subject: 'Reminder: Less than 24 hours away...'
      }
    }
  },

  PRESSURE_WASH: {
    label: 'Pressure Washing',
    type: 'PRESSURE_WASH',
    howSoonLabel: 'How Soon Do You Need Pressure Washing Help?',
    requestDetailProps: [
      'zip',
      'deliveryTime',
      'pressureWashItems',
      'images',
      'videos',
      'remark',
    ],
    reminderMailTemplatesData: {
      twoWeeksBefore: {
        info: 'This email is to remind you that your pressure washing appointment is coming up in 2 weeks on',
        subject: "Your Pressure Washing is 2 Weeks Away"
      },
      oneWeekBefore: {
        info: 'This email is to remind you that your pressure washing appointment is coming up in 1 week on',
        subject: 'Your pressure washing… 1 more week'
      },
      onAppointmentDate: {
        info: 'This email is to remind you that your pressure washing appointment is coming up in less than 24 hours on',
        subject: 'Reminder: Less than 24 hours away...'
      }
    }
  },
  GARAGE: {
    label: 'Garage Organizing',
    type: 'GARAGE',
    howSoonLabel: 'How Soon Do You Need Organizing Help?',
    requestDetailProps: [
      'zip',
      'deliveryTime',
      'organized',
      'images',
      'videos',
      'remark',
    ],
    reminderMailTemplatesData: {
      twoWeeksBefore: {
        info: 'This email is to remind you that your garage organizing appointment is coming up in 2 weeks on',
        subject: "Your Garage Organizing is 2 Weeks Away"
      },
      oneWeekBefore: {
        info: 'This email is to remind you that your garage organizing appointment is coming up in 1 week on',
        subject: 'Your garage organizing… 1 more week'
      },
      onAppointmentDate: {
        info: 'This email is to remind you that your garage organizing appointment is coming up in less than 24 hours on',
        subject: 'Reminder: Less than 24 hours away...'
      }
    }
  },
  OTHER: {
    label: 'Other',
    type: 'OTHER',
    howSoonLabel: 'How Soon Do You Need It?',
    requestDetailProps: [
      'zip',
      'deliveryTime',
      'whatHelpNeed',
      'images',
      'videos',
      'remark',
    ],
    reminderMailTemplatesData: {
      twoWeeksBefore: {
        info: 'This email is to remind you that your appointment in regards to the help you requested via RunMySale is coming up in 2 weeks on',
        subject: "Your Appointment is 2 Weeks Away"
      },
      oneWeekBefore: {
        info: 'This email is to remind you that your appointment in regards to the help you requested via RunMySale is coming up in 1 week on',
        subject: 'Your appointment… 1 more week'
      },
      onAppointmentDate: {
        info: 'This email is to remind you that your appointment in regards to the help you requested via RunMySale is coming up in less than 24 hours on',
        subject: 'Reminder: Less than 24 hours away...'
      }
    }
  },
};
