# Ingenium Report Service

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen.svg)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/docker-supported-blue.svg)](https://www.docker.com/)
[![OpenAPI](https://img.shields.io/badge/OpenAPI-3.0-green.svg)](https://swagger.io/specification/)

An open source report generation service for procedures and executions with PDF and Excel export capabilities. Built with Node.js, Express, and OpenAPI.

## 🚀 Features

- **PDF Generation**: Convert procedures and execution reports to PDF format using Puppeteer
- **Excel Export**: Generate detailed execution reports in Excel format
- **Difference Reports**: Compare procedures and executions with visual diff reports
- **Search Reports**: Export search results to Excel
- **OpenAPI Integration**: Full API documentation and validation
- **JWT Authentication**: Secure API access with scope-based authorization
- **Async Processing**: Background report generation with Redis queue
- **Email Notifications**: Automated email alerts for report completion

## 📋 Prerequisites

- **Node.js** >= 14.0.0
- **NPM** >= 6.10.0
- **Docker** (optional, for containerized deployment)
- **Redis** (for background job processing)
- **SMTP Server** (for email notifications)

## 🛠️ Installation

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/OpenIngenium/report_server.git 
   cd ingenium-report-service
   ```

2. **Install dependencies**
   ```bash
   cd server
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env  # Create your environment file
   # Edit .env with your configuration
   ```

4. **Start the server**
   ```bash
   npm start
   ```

### Docker Deployment

1. **Build the container**
   ```bash
   docker build -t ingenium-report-service .
   ```

2. **Run with Docker Compose** (recommended)
   ```bash
   docker-compose up -d
   ```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the server directory with the following variables:

```bash
# Server Configuration
URL_PORT=3003
ING_SERVER=http://localhost  # TODO: Update with your Ingenium server URL
CORE_API_URL=http://127.0.0.1:8080/api/v5/  # TODO: Update with your core API URL
SEARCH_API_URL=http://127.0.0.1:3025/api/v1/  # TODO: Update with your search API URL

# File Storage
FILE_SERVER_API_HOST=http://127.0.0.1:9000  # TODO: Update with your file server URL
OUTPUT_DIR=output

# Redis Configuration (required for background jobs)
REDIS_HOST=127.0.0.1  # TODO: Update with your Redis host
REDIS_PORT=6379       # TODO: Update with your Redis port

# Email Configuration (required for notifications)
SMTP_HOST=smtp.example.com  # TODO: Update with your SMTP server hostname
SMTP_HOST_PORT=25           # TODO: Update with your SMTP server port

# Security (required for JWT authentication)
PUBLIC_PEM=your-jwt-public-key  # TODO: Add your JWT RS256 public key

# Report Generation Timeouts
REPORT_TIMEOUT=600000  # 10 minutes
HTML_TIMEOUT=300000    # 5 minutes
NUM_WORKERS=4

# Optional: Browser debugging
BROWSER_DEBUG=false
```

### Email Configuration

Update email settings in `server/funcs.js`:
```javascript
// TODO: Configure with your organization's email domain
from: 'Ingenium Report Service <do_not_reply@your-domain.com>', 
to: `${to_username}@your-domain.com`,
```

## 🔌 API Documentation

Once the server is running, access the interactive API documentation at:
- **Swagger UI**: http://localhost:3003/api-docs/
- **OpenAPI Spec**: http://localhost:3003/spec/openapi.yaml

### Available Endpoints

- `GET /pdf/procedures/{procedure_id}/versions/{version}` - Generate procedure PDF
- `GET /pdf/executions/{execution_id}` - Generate execution PDF
- `GET /executions` - Export execution data to Excel
- `GET /difference_report` - Request difference report generation
- `POST /search_report` - Generate search result reports
- `GET /health` - Health check endpoint

## 🏗️ Architecture

This service follows an OpenAPI-first design pattern with the following structure:

### Core Components

- **`index.js`** - Application entry point
- **`expressServer.js`** - Express server configuration with OpenAPI validation
- **`config.js`** - Environment-based configuration
- **`logger.js`** - Winston-based JSON logging

### Directory Structure

```
server/
├── api/
│   └── openapi.yaml          # OpenAPI specification
├── controllers/              # HTTP request handlers
├── services/                 # Business logic
│   ├── pdf/                 # PDF generation
│   ├── executions/          # Excel export
│   └── diff_report/         # Difference reporting
├── utils/
│   └── openapiRouter.js     # Automatic API routing
└── tests/                   # Test files
```

### Request Flow

1. **OpenAPI Validation** - Requests validated against schema
2. **JWT Authentication** - Token verification and scope checking
3. **Controller** - Parameter extraction and routing
4. **Service** - Business logic execution
5. **Response** - Formatted response with appropriate content type

## 🧪 Testing

### Run Tests
```bash
npm test
```

### Python Integration Tests
```bash
cd tests
pip install -r requirements.txt
python test_ci_health.py
python test_ci_pdf.py
```

## 🐳 Docker

### Build Image
```bash
docker build -t ingenium-report-service .
```

### Run Container
```bash
docker run -p 3003:3003 \
  -e CORE_API_URL=your-api-url \          # TODO: Replace with your API URL
  -e REDIS_HOST=your-redis-host \         # TODO: Replace with your Redis host
  -e SMTP_HOST=your-smtp-server \         # TODO: Replace with your SMTP server
  -e PUBLIC_PEM="your-jwt-public-key" \   # TODO: Replace with your JWT public key
  ingenium-report-service
```

## 📝 Development

### Code Structure

#### Controllers
Handle HTTP requests, extract parameters, and delegate to services:
```javascript
// Example: PDFController.js
async pdf_execution_get(request, response) {
  await Controller.handleRequest(request, response, this.service.pdf_execution_get);
}
```

#### Services
Contain business logic and external API interactions:
```javascript
// Example: PDFService.js
static async pdf_execution_get({ execution_id, options, authorization_header }) {
  const pdf_buffer = await proc_export.execution_pdf(/* params */);
  return Service.successResponse({'_pdf_buffer': pdf_buffer});
}
```

### Adding New Endpoints

1. Update `api/openapi.yaml` with new endpoint specification
2. Add controller method in appropriate controller class
3. Add service method in corresponding service class
4. The OpenAPI router will automatically route requests

## 🔒 Security

- **JWT Authentication** with RS256 algorithm
- **Scope-based authorization** for different endpoint access levels
- **Input validation** through OpenAPI schema validation
- **Security headers** and CORS configuration

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and add tests
4. Ensure all tests pass: `npm test`
5. Submit a pull request

## 📄 License

This project is licensed under the Apache License 2.0. See [LICENSE](LICENSE) file for details.


---

