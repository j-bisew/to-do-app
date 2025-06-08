const amqp = require('amqplib');

class NotificationService {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      const rabbitUrl = `amqp://${process.env.RABBITMQ_USER || 'admin'}:${process.env.RABBITMQ_PASSWORD || 'adminpass123'}@${process.env.RABBITMQ_HOST || 'localhost'}:${process.env.RABBITMQ_PORT || 5672}`;
      
      this.connection = await amqp.connect(rabbitUrl);
      this.channel = await this.connection.createChannel();
      
      // Declare queues
      await this.channel.assertQueue('notifications', { durable: true });
      await this.channel.assertQueue('email_notifications', { durable: true });
      await this.channel.assertQueue('push_notifications', { durable: true });
      
      // Set prefetch to handle one message at a time
      await this.channel.prefetch(1);
      
      this.isConnected = true;
      console.log('✅ Connected to RabbitMQ');
      
      // Set up error handling
      this.connection.on('error', (err) => {
        console.error('RabbitMQ connection error:', err);
        this.isConnected = false;
      });
      
      this.connection.on('close', () => {
        console.log('RabbitMQ connection closed');
        this.isConnected = false;
      });
      
    } catch (error) {
      console.error('Failed to connect to RabbitMQ:', error);
      throw error;
    }
  }

  async startConsumer() {
    if (!this.isConnected) {
      throw new Error('Not connected to RabbitMQ');
    }

    console.log('🎧 Starting notification consumer...');
    
    // Consume notifications from main queue
    await this.channel.consume('notifications', async (msg) => {
      if (msg) {
        try {
          const notification = JSON.parse(msg.content.toString());
          await this.processNotification(notification);
          this.channel.ack(msg);
        } catch (error) {
          console.error('Error processing notification:', error);
          this.channel.nack(msg, false, false); // Don't requeue
        }
      }
    });
  }

  async processNotification(notification) {
    console.log('📬 Processing notification:', notification);
    
    switch (notification.type) {
      case 'todo_created':
        await this.handleTodoCreated(notification);
        break;
      case 'todo_completed':
        await this.handleTodoCompleted(notification);
        break;
      case 'todo_due_soon':
        await this.handleTodoDueSoon(notification);
        break;
      case 'user_registered':
        await this.handleUserRegistered(notification);
        break;
      default:
        console.log('Unknown notification type:', notification.type);
    }
  }

  async handleTodoCreated(notification) {
    console.log(`✨ New todo created: "${notification.title}" for user ${notification.userId}`);
    
    // Send welcome email for first todo
    const emailNotification = {
      type: 'welcome_email',
      userId: notification.userId,
      todoTitle: notification.title,
      timestamp: notification.timestamp
    };
    
    await this.sendToQueue('email_notifications', emailNotification);
    
    // Send push notification
    const pushNotification = {
      type: 'todo_created_push',
      userId: notification.userId,
      title: 'New Todo Created',
      body: `"${notification.title}" has been added to your list`,
      timestamp: notification.timestamp
    };
    
    await this.sendToQueue('push_notifications', pushNotification);
  }

  async handleTodoCompleted(notification) {
    console.log(`✅ Todo completed: "${notification.title}" for user ${notification.userId}`);
    
    // Send congratulations push notification
    const pushNotification = {
      type: 'todo_completed_push',
      userId: notification.userId,
      title: 'Todo Completed!',
      body: `Great job! You completed "${notification.title}"`,
      timestamp: notification.timestamp
    };
    
    await this.sendToQueue('push_notifications', pushNotification);
  }

  async handleTodoDueSoon(notification) {
    console.log(`⏰ Todo due soon: "${notification.title}" for user ${notification.userId}`);
    
    // Send reminder email
    const emailNotification = {
      type: 'due_reminder_email',
      userId: notification.userId,
      todoTitle: notification.title,
      dueDate: notification.dueDate,
      timestamp: notification.timestamp
    };
    
    await this.sendToQueue('email_notifications', emailNotification);
  }

  async handleUserRegistered(notification) {
    console.log(`👋 New user registered: ${notification.username}`);
    
    // Send welcome email
    const emailNotification = {
      type: 'welcome_user_email',
      userId: notification.userId,
      username: notification.username,
      email: notification.email,
      timestamp: notification.timestamp
    };
    
    await this.sendToQueue('email_notifications', emailNotification);
  }

  async sendToQueue(queueName, message) {
    if (!this.isConnected) {
      console.error('Cannot send message - not connected to RabbitMQ');
      return;
    }

    try {
      await this.channel.sendToQueue(
        queueName,
        Buffer.from(JSON.stringify(message)),
        { persistent: true }
      );
      console.log(`📤 Sent message to ${queueName}:`, message.type);
    } catch (error) {
      console.error(`Failed to send message to ${queueName}:`, error);
    }
  }

  async close() {
    if (this.connection) {
      await this.connection.close();
      this.isConnected = false;
      console.log('RabbitMQ connection closed');
    }
  }
}

// Email service simulator
class EmailService {
  constructor(notificationService) {
    this.notificationService = notificationService;
  }

  async startConsumer() {
    if (!this.notificationService.isConnected) {
      throw new Error('Notification service not connected');
    }

    console.log('📧 Starting email consumer...');
    
    await this.notificationService.channel.consume('email_notifications', async (msg) => {
      if (msg) {
        try {
          const emailData = JSON.parse(msg.content.toString());
          await this.sendEmail(emailData);
          this.notificationService.channel.ack(msg);
        } catch (error) {
          console.error('Error sending email:', error);
          this.notificationService.channel.nack(msg, false, false);
        }
      }
    });
  }

  async sendEmail(emailData) {
    // Simulate email sending
    console.log('📧 Sending email:', {
      type: emailData.type,
      userId: emailData.userId,
      subject: this.getEmailSubject(emailData),
      timestamp: new Date().toISOString()
    });
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('✅ Email sent successfully');
  }

  getEmailSubject(emailData) {
    switch (emailData.type) {
      case 'welcome_email':
        return 'Your new todo has been created!';
      case 'due_reminder_email':
        return `Reminder: "${emailData.todoTitle}" is due soon`;
      case 'welcome_user_email':
        return `Welcome to Todo App, ${emailData.username}!`;
      default:
        return 'Notification from Todo App';
    }
  }
}

// Push notification service simulator
class PushService {
  constructor(notificationService) {
    this.notificationService = notificationService;
  }

  async startConsumer() {
    if (!this.notificationService.isConnected) {
      throw new Error('Notification service not connected');
    }

    console.log('📱 Starting push notification consumer...');
    
    await this.notificationService.channel.consume('push_notifications', async (msg) => {
      if (msg) {
        try {
          const pushData = JSON.parse(msg.content.toString());
          await this.sendPushNotification(pushData);
          this.notificationService.channel.ack(msg);
        } catch (error) {
          console.error('Error sending push notification:', error);
          this.notificationService.channel.nack(msg, false, false);
        }
      }
    });
  }

  async sendPushNotification(pushData) {
    // Simulate push notification sending
    console.log('📱 Sending push notification:', {
      userId: pushData.userId,
      title: pushData.title,
      body: pushData.body,
      timestamp: new Date().toISOString()
    });
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('✅ Push notification sent successfully');
  }
}

// Main application
async function main() {
  const notificationService = new NotificationService();
  const emailService = new EmailService(notificationService);
  const pushService = new PushService(notificationService);

  try {
    // Connect to RabbitMQ
    await notificationService.connect();
    
    // Start all consumers
    await notificationService.startConsumer();
    await emailService.startConsumer();
    await pushService.startConsumer();
    
    console.log('🚀 Notification service started successfully');
    
    // Graceful shutdown
    const gracefulShutdown = async () => {
      console.log('📴 Shutting down notification service...');
      await notificationService.close();
      process.exit(0);
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
    
  } catch (error) {
    console.error('❌ Failed to start notification service:', error);
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the service
main();