import aws = require('aws-sdk');

aws.config.region = process.env.AWS_REGION;

const AWS_credential = {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY
}

export const awsS3Client = new aws.S3(AWS_credential);