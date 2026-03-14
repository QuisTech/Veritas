# Use Node.js 20 slim as the base image
FROM node:20-slim

# Set the working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the frontend and perform any necessary pre-compilation
RUN npm run build

# Expose the port (Cloud Run sets PORT env var, but this is good practice)
EXPOSE 8080

# Start the application using tsx as defined in package.json
CMD ["npm", "start"]
