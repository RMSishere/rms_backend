import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';

async function dropIndex() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const connection = app.get<Connection>(getConnectionToken());

  try {
    const result = await connection.collection('users').dropIndex('notificationSubscriptions.id_1');
    console.log('Dropped index:', result);
  } catch (err) {
    if (err.codeName === 'IndexNotFound') {
      console.log('Index not found, nothing to drop.');
    } else {
      console.error('Failed to drop index:', err);
    }
  } finally {
    await app.close();
  }
}

dropIndex();
