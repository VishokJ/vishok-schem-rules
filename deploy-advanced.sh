#!/bin/bash

# Advanced deployment script for schem-rules-fe
# Usage: ./deploy-advanced.sh [options]
# Options:
#   --no-build    Skip the build step
#   --no-restart  Skip the PM2 restart
#   --logs        Show logs after deployment
#   --help        Show this help message

set -e  # Exit on any error

# Configuration
EC2_HOST="44.252.105.237"
EC2_USER="ec2-user"
KEY_FILE="vishok-schem-rules.pem"
PROJECT_DIR="/home/ec2-user/vishok-schem-rules"

# Default options
BUILD=true
RESTART=true
SHOW_LOGS=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --no-build)
            BUILD=false
            shift
            ;;
        --no-restart)
            RESTART=false
            shift
            ;;
        --logs)
            SHOW_LOGS=true
            shift
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  --no-build    Skip the build step"
            echo "  --no-restart  Skip the PM2 restart"
            echo "  --logs        Show logs after deployment"
            echo "  --help        Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

echo "🚀 Starting advanced deployment to EC2..."

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

# Function to check if command exists on EC2
command_exists_on_ec2() {
    run_on_ec2 "command -v $1 >/dev/null 2>&1"
}

echo "📡 Connecting to EC2 instance..."

# Check EC2 connectivity
if ! run_on_ec2 "echo 'Connection successful'"; then
    echo "❌ Failed to connect to EC2 instance"
    exit 1
fi

# Step 1: Create backup
echo "💾 Creating backup of current deployment..."
run_on_ec2 "cd $PROJECT_DIR && git stash push -m 'Pre-deployment backup $(date)'" || echo "⚠️  No changes to backup"

# Step 2: Pull latest code
echo "📥 Pulling latest code from main branch..."
run_on_ec2 "cd $PROJECT_DIR && git fetch origin && git reset --hard origin/main"

# Step 3: Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
run_on_ec2 "cd $PROJECT_DIR && npm ci"

# Step 4: Install Python dependencies
echo "🐍 Installing Python dependencies..."
if command_exists_on_ec2 "python3"; then
    if command_exists_on_ec2 "pip3"; then
        run_on_ec2 "cd $PROJECT_DIR && pip3 install -r requirements.txt --user"
    else
        run_on_ec2 "cd $PROJECT_DIR && python3 -m pip install -r requirements.txt --user"
    fi
    echo "✅ Python dependencies installed"
else
    echo "⚠️  Python3 not found - skipping Python dependencies"
fi

# Step 5: Copy environment variables
echo "🔧 Updating environment variables..."
if [ -f ".env" ]; then
    scp -i "$KEY_FILE" .env "$EC2_USER@$EC2_HOST:$PROJECT_DIR/.env"
    echo "✅ Environment variables updated"
else
    echo "⚠️  No .env file found locally - skipping env update"
fi

# Step 6: Build the application (if enabled)
if [ "$BUILD" = true ]; then
    echo "🔨 Building the application..."
    run_on_ec2 "cd $PROJECT_DIR && npm run build"
    echo "✅ Build completed"
else
    echo "⏭️  Skipping build step"
fi

# Step 7: Restart the application with PM2 (if enabled)
if [ "$RESTART" = true ]; then
    echo "🔄 Restarting the application..."
    
    # Check if PM2 process exists
    if run_on_ec2 "pm2 list | grep -q schem-rules"; then
        run_on_ec2 "cd $PROJECT_DIR && pm2 restart schem-rules --update-env"
        echo "✅ Application restarted"
    else
        echo "⚠️  PM2 process 'schem-rules' not found. Starting new process..."
        run_on_ec2 "cd $PROJECT_DIR && pm2 start npm --name 'schem-rules' -- start"
        echo "✅ Application started"
    fi
else
    echo "⏭️  Skipping restart step"
fi

# Step 8: Check status
echo "📊 Checking application status..."
run_on_ec2 "pm2 list"

# Step 9: Health check
echo "🔍 Performing health check..."
sleep 3
if run_on_ec2 "pm2 list | grep -q 'online'"; then
    echo "✅ Application is running"
else
    echo "❌ Application appears to be down"
    run_on_ec2 "pm2 logs schem-rules --lines 20"
    exit 1
fi

# Step 10: Show logs (if requested)
if [ "$SHOW_LOGS" = true ]; then
    echo "📋 Application logs:"
    run_on_ec2 "pm2 logs schem-rules --lines 20"
fi

echo ""
echo "✅ Advanced deployment completed successfully!"
echo "🌐 Your application should be running at: http://$EC2_HOST:3000"
echo ""
echo "Useful commands:"
echo "  Check logs:    ssh -i $KEY_FILE $EC2_USER@$EC2_HOST 'pm2 logs schem-rules'"
echo "  Check status:  ssh -i $KEY_FILE $EC2_USER@$EC2_HOST 'pm2 list'"
echo "  Stop app:      ssh -i $KEY_FILE $EC2_USER@$EC2_HOST 'pm2 stop schem-rules'"
echo "  Start app:     ssh -i $KEY_FILE $EC2_USER@$EC2_HOST 'pm2 start schem-rules'"