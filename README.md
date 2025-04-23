# IELTS Exam Simulation Platform

An advanced IELTS exam preparation platform that provides comprehensive test preparation across listening, reading, writing, and speaking modules, featuring cutting-edge learning technologies and personalized study experiences.

## Features

- **Complete IELTS Test Modules**
  - Reading, Writing, Speaking, and Listening test components
  - Realistic test simulation and timing
  - Detailed scoring with feedback and improvement suggestions

- **Advanced Vocabulary System**
  - PACE repetition technique for effective vocabulary retention
  - OpenAI-powered vocabulary analysis with CEFR levels
  - Word family connections and context examples

- **Personalized Learning Experience**
  - Smart Notification Center with contextual learning reminders
  - Gamification Rewards System with badges, levels, and points
  - Login streak tracking and achievement rewards
  - User progress dashboard

- **Language Support**
  - Arabic/English translation (powered by OpenAI)
  - Bilingual interface elements

- **Technical Highlights**
  - React.js with TypeScript frontend
  - Express.js backend
  - OpenAI integration for analysis and translation
  - Role-based authentication with secure password handling
  - Responsive design with light/dark mode

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- NPM (v9 or higher)
- SendGrid API Key (for email notifications)
- OpenAI API Key (for AI-powered features)

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/your-username/ielts-simulation-platform.git
   cd ielts-simulation-platform
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Set up environment variables
   Create a `.env` file in the root directory with the following variables:
   ```
   SENDGRID_API_KEY=your_sendgrid_api_key
   OPENAI_API_KEY=your_openai_api_key
   SESSION_SECRET=your_session_secret
   ```

4. Start the development server
   ```bash
   npm run dev
   ```

## Project Structure

- `/client` - Frontend React application
  - `/src/components` - UI components
  - `/src/hooks` - Custom React hooks
  - `/src/pages` - Application pages
  - `/src/lib` - Utility functions and API clients

- `/server` - Backend Express application
  - `/routes.ts` - API endpoints
  - `/auth.ts` - Authentication system
  - `/storage.ts` - Data storage interface
  - `/utils` - Utility functions and services

- `/shared` - Shared TypeScript definitions
  - `/schema.ts` - Data models and validation schemas

## License

This project is licensed under the MIT License - see the LICENSE file for details.