import swaggerJSDoc from 'swagger-jsdoc';

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'OrderUp SaaS API',
      version: '1.0.0',
      description: 'API documentation for OrderUp multi-tenant PWA platform',
      contact: {
        name: 'OrderUp Architecture Team',
        email: 'support@orderup.co.ke',
      },
    },
    servers: [
      {
        url: '/api/v1',
        description: 'V1 API Gateway',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        tenantHeader: {
          type: 'apiKey',
          in: 'header',
          name: 'X-Tenant-ID',
          description: 'Tenant UUID for multi-tenant isolation',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
        tenantHeader: [],
      },
    ],
  },
  apis: ['./src/modules/**/*.routes.ts', './src/modules/**/*.schema.ts'],
};

export const swaggerSpec = swaggerJSDoc(options);
