FROM mongo:6.0

# Create data directory
RUN mkdir -p /data/db

# Set permissions
RUN chown -R mongodb:mongodb /data/db

# Expose MongoDB port
EXPOSE 27017

# Start MongoDB
CMD ["mongod", "--bind_ip_all"] 