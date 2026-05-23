import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. HTTP Security Headers
  app.use((req: any, res: any, next: any) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'");
    next();
  });

  // 2. Enable CORS for development
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // 3. Set Global Prefix
  app.setGlobalPrefix('api/v1', { exclude: ['api/docs'] });

  // 4. Enforce strict DTO validations globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // 3. Configure Swagger Interactive Developer Dashboard
  const config = new DocumentBuilder()
    .setTitle('Dayzo Social Streak Platform API')
    .setDescription('Cinematic REST API docs for managing self-improvement challenges, streaks, levels, leaderboards, and sharing cards.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // 4. Start Server Listening
  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🚀 Dayzo Backend running on: http://localhost:${port}`);
  console.log(`📄 Swagger Interactive API docs at: http://localhost:${port}/api/docs`);
}
bootstrap();
