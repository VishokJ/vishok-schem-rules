#!/bin/bash

# Automated deployment script for schem-rules-fe
# Usage: ./deploy.sh

set -e  # Exit on any error

# Configuration
EC2_HOST="44.252.105.237"
EC2_USER="ec2-user"
KEY_FILE="vishok-schem-rules.pem"
PROJECT_DIR="/home/ec2-user/vishok-schem-rules"

echo "🚀 Starting deployment to EC2..."

# Check if key file exists
if [ ! -f "$KEY_FILE" ]; then
    echo "❌ Error: SSH key file '$KEY_FILE' not found in current directory"
    echo "Please make sure the key file is in the same directory as this script"
    exit 1
fi

# Function to run commands on EC2
run_on_ec2() {
    ssh -i "$KEY_FILE" "$EC2_USER@$EC2_HOST" "$1"
}

echo "📡 Connecting to EC2 instance..."

# Step 1: Pull latest code
echo "📥 Pulling latest code from main branch..."
run_on_ec2 "cd $PROJECT_DIR && git pull origin main"

# Step 2: Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
run_on_ec2 "cd $PROJECT_DIR && npm install"

# Step 3: Install Python dependencies (if pip3 is available)
echo "🐍 Installing Python dependencies..."
run_on_ec2 "cd $PROJECT_DIR && python3 -m pip install -r requirements.txt --user" || echo "⚠️  Python dependencies installation failed or pip not available"

# Step 4: Copy environment variables
echo "🔧 Updating environment variables..."
if [ -f ".env" ]; then
    scp -i "$KEY_FILE" .env "$EC2_USER@$EC2_HOST:$PROJECT_DIR/.env"
    echo "✅ Environment variables updated"
else
    echo "⚠️  No .env file found locally - skipping env update"
fi

# Step 5: Build the application
echo "🔨 Building the application..."
run_on_ec2 "cd $PROJECT_DIR && npm run build"

# Step 6: Restart the application with PM2
echo "🔄 Restarting the application..."
run_on_ec2 "cd $PROJECT_DIR && pm2 restart schem-rules --update-env"

# Step 7: Check status
echo "📊 Checking application status..."
run_on_ec2 "pm2 list"

echo ""
echo "✅ Deployment completed successfully!"
echo "🌐 Your application should be running at: http://$EC2_HOST:3000"
echo ""
echo "To check logs, run:"
echo "ssh -i $KEY_FILE $EC2_USER@$EC2_HOST 'pm2 logs schem-rules'"