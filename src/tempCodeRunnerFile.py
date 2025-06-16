def initialize_database():
    """Ensure database has necessary collections and fields"""
    # Ensure users have status field
    users = list(mongo.db.users.find({'status': {'$exists': False}}))
    for user in users:
        mongo.db.users.update_one(
            {'_id': user['_id']},
            {'$set': {'status': 'active'}}
        )
    
    # Create sessions collection if it doesn't exist
    if 'sessions' not in mongo.db.list_collection_names():
        mongo.db.create_collection('sessions')
    
    # Create TTL index on sessions to automatically expire old sessions
    mongo.db.sessions.create_index(
        [('last_active', 1)],
        expireAfterSeconds=3600  # Sessions expire after 1 hour of inactivity
    )
    
    app.logger.info("Database initialization complete")