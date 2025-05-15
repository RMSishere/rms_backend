import { Injectable } from '@nestjs/common';
import { awsS3Client } from './util/aws';

@Injectable()
export class AppService {
  async getHello(): Promise<any> {
    return 'Hello World!';
  }

  async getSignedUploadUrl(fileName: string, fileType: string): Promise<any> {
    try {
      const newFileName = `${Date.now()}_${fileName}`;
      const s3Params = {
        Bucket: process.env.AWS_S3_BUCKET,
        Key: newFileName,
        Expires: 300, // in seconds
        ContentType: fileType,
        ACL: 'public-read',
      };

      const data = await new Promise((resolve, reject) => {
        awsS3Client.getSignedUrl('putObject', s3Params, (err, data) => {
          if (err) {
            reject(err);
          }
          // resolve(data);
          resolve({
            signedRequest: data,
            url: `https://${process.env.AWS_S3_BUCKET}.s3.amazonaws.com/${newFileName}`,
          });
        });
      });

      return data;
    } catch (error) {
      throw error;
    }
  }
}
