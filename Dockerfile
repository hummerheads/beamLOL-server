# Use an official Node.js image
FROM node:18

# Set the working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package.json .
RUN npm install

# Copy the rest of the application files
COPY . .

# Start the application
CMD ["node", "Index.js"]