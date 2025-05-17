import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

async function dropIndex() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const connection = app.get<Connection>(getConnectionToken());

  try {
    const result = await connection.collection('users').dropIndex('notificationSubscriptions.title_1');
    console.log('✅ Dropped index:', result);
  } catch (err) {
    if (err.codeName === 'IndexNotFound') {
      console.log('ℹ️ Index not found.');
    } else {
      console.error('❌ Failed to drop index:', err);
    }
  } finally {
    await app.close();
  }
}

dropIndex();
