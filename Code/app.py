from dotenv import load_dotenv
from flask import Flask, render_template, request, redirect, url_for, session, jsonify
from flask_pymongo import PyMongo
from bson.objectid import ObjectId
from datetime import datetime, timedelta, UTC
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
from collections import defaultdict
import pytz
import google.generativeai as genai
from flask_cors import CORS
import logging
import os
from functools import wraps
from livereload import Server
import google.generativeai as genai


load_dotenv()
print("GOOGLE_API_KEY is:", os.getenv('GOOGLE_API_KEY'))

# Initialize Flask app
app = Flask(__name__)
CORS(app)

app.config['MONGO_URI'] = os.getenv('MONGO_URI', 'mongodb+srv://priheaparmar:prihea12@prihea.5gxaufz.mongodb.net/chatbot?retryWrites=true&w=majority&appName=Prihea')
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', '7899bb88ad902fee5ade5caed072290794b51cb42ee35b965a597023b82f5260')  # Change in production
mongo = PyMongo(app)

# Configure logging
logging.basicConfig(level=logging.INFO)

# Configure Google Generative AI with environment variable

# Instead of hardcoded API key
genai.configure(api_key=os.getenv('GOOGLE_API_KEY'))

# Model configuration
generation_config = {
    "temperature": 1,
    "top_p": 0.95,
    "top_k": 40,
    "max_output_tokens": 8192,
    "response_mime_type": "text/plain",
}

# Initialize Gemini model
model = genai.GenerativeModel(
    model_name="gemini-2.0-flash-exp",
    generation_config=generation_config,
    system_instruction="You are an Expert AI Legal Bot specializing exclusively in Indian law..."  # Your instruction here
)

# Login required decorator
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'username' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

# Admin required decorator
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'username' not in session or session['username'] != 'admin':
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

# Error handler decorator
def handle_db_errors(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except Exception as e:
            app.logger.error(f"Database error: {str(e)}")
            return jsonify({'status': 'error', 'message': 'A database error occurred'}), 500
    return decorated_function

@app.route('/')
def home():
    if 'username' in session:
        return redirect(url_for('chat'))
    return render_template('homepage-2.html')

@app.route('/homepage2')
def homepage2():
    return render_template('homepage-2.html')

@app.route('/homepage')
def homepage():
    return render_template('homepage.html')

@app.route('/aboutus')
def aboutus():
    return render_template('aboutus.html')

@app.route('/contact')
def contact():
    return render_template('contactus.html')

@app.route('/forgot_password', methods=['GET', 'POST'])
def forgot_password():
    if request.method == 'POST':
        email = request.form.get('email')
        # TODO: Implement proper password reset logic
        return render_template('forgot_password.html', message='Password reset link sent (demo).')
    return render_template('forgot_password.html')

@app.route('/signup', methods=['GET', 'POST'])
@handle_db_errors
def signup():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        if not username or not password:
            return render_template('signup.html', error='Username and password are required')
            
        if mongo.db.users.find_one({'username': username}):
            return render_template('signup.html', error='Username already exists!')
            
        hashed_password = generate_password_hash(password)
        mongo.db.users.insert_one({
            'username': username, 
            'password': hashed_password,
            'status': 'active',
            'created_at': datetime.now(UTC)
        })
        return redirect(url_for('login'))
    return render_template('signup.html')

@app.route('/login', methods=['GET', 'POST'])
@handle_db_errors
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        if not username or not password:
            return render_template('login.html', error='Username and password are required')
            
        user = mongo.db.users.find_one({'username': username})
        if user and check_password_hash(user['password'], password):
            # Check if user is banned
            if user.get('status') == 'banned':
                return render_template('login.html', error='This account has been banned')
                
            session['username'] = username
            
            # Track user IP and last login
            mongo.db.users.update_one(
                {'username': username},
                {'$set': {
                    'last_ip': request.remote_addr,
                    'last_login': datetime.now(UTC),
                    'status': user.get('status', 'active')
                }}
            )
            
            # Track active session
            mongo.db.sessions.update_one(
                {'username': username},
                {'$set': {'last_active': datetime.now(UTC)}},
                upsert=True
            )
            
            if username == 'admin':
                return redirect(url_for('admin_dashboard'))
            else:
                return redirect(url_for('chat'))

        return render_template('login.html', error='Invalid credentials!')
    return render_template('login.html')

@app.route('/new_chat', methods=['POST'])
@login_required
@handle_db_errors
def new_chat():
    conv = {
        'username': session['username'],
        'created_at': datetime.now(UTC)
    }
    result = mongo.db.conversations.insert_one(conv)
    session['current_conversation'] = str(result.inserted_id)
    return jsonify({'status': 'success', 'conversation_id': str(result.inserted_id)})

@app.route('/admin_dashboard')
@admin_required
def admin_dashboard():
    return render_template('admin.html')

@app.route('/chats')
@login_required
def chats():
    return render_template('chat.html',
                       username=session.get('username'),
                       grouped_chats={},
                       conversations=[],
                       active_conversation=None)

@app.route('/chat', methods=['GET', 'POST'])
@login_required
@handle_db_errors
def chat():
    # Update last active timestamp for this user
    mongo.db.sessions.update_one(
        {'username': session['username']},
        {'$set': {'last_active': datetime.now(UTC)}},
        upsert=True
    )
    
    if request.method == 'POST':
        if request.is_json:
            data = request.get_json()
            user_message = data.get('message', '')
            conversation_id = session.get('current_conversation')
            timestamp = datetime.now(UTC)

            if not conversation_id:
                result = mongo.db.conversations.insert_one({
                    'username': session.get('username'),
                    'created_at': timestamp
                })
                conversation_id = str(result.inserted_id)
                session['current_conversation'] = conversation_id

            # Get conversation history for context
            chat_history = list(mongo.db.chats.find({
                'conversation_id': conversation_id
            }).sort('timestamp', 1))
            
            history_for_model = []
            for chat in chat_history:
                role = "user" if chat['username'] == session['username'] else "model"
                history_for_model.append({
                    "role": role,
                    "parts": [chat['message']]
                })

            # Save user message
            mongo.db.chats.insert_one({
                'username': session['username'],
                'message': user_message,
                'timestamp': timestamp,
                'conversation_id': conversation_id
            })

            # Generate bot reply using Gemini with conversation history
            chat_session = model.start_chat(history=history_for_model)
            response = chat_session.send_message(user_message)
            bot_reply = response.text

            # Save bot reply
            mongo.db.chats.insert_one({
                'username': 'StaRK',
                'message': bot_reply,
                'timestamp': timestamp,
                'conversation_id': conversation_id
            })

            return jsonify({'status': 'success'})
        else:
            return jsonify({'status': 'error', 'message': 'Content-Type must be application/json'}), 415

    conversations = list(mongo.db.conversations.find({'username': session['username']}).sort('created_at', -1))
    active_conv_id = session.get('current_conversation')
    grouped_chats = defaultdict(list)
    local_tz = pytz.timezone('Asia/Kolkata')

    if active_conv_id:
        chat_history_data = list(mongo.db.chats.find({'conversation_id': active_conv_id}).sort('timestamp', 1))
        for chat in chat_history_data:
            if 'timestamp' not in chat:
                continue
            local_time = chat['timestamp'].astimezone(local_tz)
            date_key = local_time.strftime('%Y-%m-%d')
            grouped_chats[date_key].append(chat)

    return render_template('chat.html', 
                           username=session['username'], 
                           grouped_chats=grouped_chats, 
                           conversations=conversations, 
                           active_conversation=active_conv_id)

@app.route('/conversation/<conv_id>')
@login_required
def switch_conversation(conv_id):
    session['current_conversation'] = conv_id
    return redirect(url_for('chat'))

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

@app.route('/delete_conversation/<conv_id>', methods=['DELETE'])
@login_required
@handle_db_errors
def delete_conversation(conv_id):
    conversation = mongo.db.conversations.find_one({'_id': ObjectId(conv_id), 'username': session['username']})
    if not conversation:
        return jsonify({'status': 'not_found'}), 404
    
    mongo.db.conversations.delete_one({'_id': ObjectId(conv_id)})
    mongo.db.chats.delete_many({'conversation_id': conv_id})
    
    if session.get('current_conversation') == conv_id:
        session.pop('current_conversation', None)
    
    return jsonify({'status': 'success'})

@app.route('/submit_contact', methods=['POST'])
@handle_db_errors
def submit_contact():
    if request.method == 'POST':
        app.logger.info(f"Received contact form submission: {request.content_type}")
        
        if request.is_json:
            data = request.get_json()
            app.logger.info(f"JSON data: {data}")
            name = data.get('name')
            email = data.get('email')
            subject = data.get('subject')
            message = data.get('message')
        else:
            app.logger.info(f"Form data: {request.form}")
            name = request.form.get('name')
            email = request.form.get('email')
            subject = request.form.get('subject')
            message = request.form.get('message')
        
        if not all([name, email, subject, message]):
            app.logger.warning("Missing required fields in contact form")
            return jsonify({'status': 'error', 'message': 'All fields are required'}), 400
        
        contact_data = {
            'name': name,
            'email': email,
            'subject': subject,
            'message': message,
            'timestamp': datetime.now(UTC),
            'status': 'unread'
        }
        
        mongo.db.contact_inquiries.insert_one(contact_data)
        app.logger.info(f"Successfully stored contact inquiry from {name}")
        return jsonify({'status': 'success', 'message': 'Your message has been sent successfully!'})
    
    return jsonify({'status': 'error', 'message': 'Invalid request method'}), 405

@app.route('/admin/inquiries')
@admin_required
@handle_db_errors
def admin_inquiries():
    inquiries = list(mongo.db.contact_inquiries.find().sort('timestamp', -1))
    
    for inquiry in inquiries:
        inquiry['_id'] = str(inquiry['_id'])
        if 'timestamp' in inquiry:
            inquiry['formatted_time'] = inquiry['timestamp'].strftime('%Y-%m-%d %H:%M:%S')
    
    return jsonify({'inquiries': inquiries})

@app.route('/admin/inquiries/<inquiry_id>/mark_read', methods=['POST'])
@admin_required
@handle_db_errors
def mark_inquiry_read(inquiry_id):
    mongo.db.contact_inquiries.update_one(
        {'_id': ObjectId(inquiry_id)},
        {'$set': {'status': 'read'}}
    )
    return jsonify({'status': 'success'})

@app.route('/admin/inquiries/<inquiry_id>', methods=['DELETE'])
@admin_required
@handle_db_errors
def delete_inquiry(inquiry_id):
    mongo.db.contact_inquiries.delete_one({'_id': ObjectId(inquiry_id)})
    return jsonify({'status': 'success'})

@app.route('/admin/user_stats')
@admin_required
@handle_db_errors
def get_user_stats():
    """Get statistics about users"""
    # Count total users (excluding admin)
    total_users = mongo.db.users.count_documents({'username': {'$ne': 'admin'}})
    
    # Get active users (users with active session in last 30 minutes)
    thirty_minutes_ago = datetime.now(UTC) - timedelta(minutes=30)
    active_sessions = mongo.db.sessions.count_documents({'last_active': {'$gte': thirty_minutes_ago}})
    
    # Count banned users
    banned_users = mongo.db.users.count_documents({'status': 'banned'})
    
    return jsonify({
        'total_users': total_users,
        'active_users': active_sessions,
        'banned_users': banned_users
    })

@app.route('/admin/users/<user_type>')
@admin_required
@handle_db_errors
def get_users_by_type(user_type):
    """Get users by type (total, active, banned)"""
    if user_type == 'total':
        # All users except admin
        users = list(mongo.db.users.find(
            {'username': {'$ne': 'admin'}}, 
            {'username': 1, 'last_ip': 1, '_id': 1}
        ))
    elif user_type == 'active':
        # Active users based on session
        thirty_minutes_ago = datetime.now(UTC) - timedelta(minutes=30)
        active_usernames = [s['username'] for s in mongo.db.sessions.find(
            {'last_active': {'$gte': thirty_minutes_ago}}
        )]
        users = list(mongo.db.users.find(
            {'username': {'$in': active_usernames}},
            {'username': 1, 'last_ip': 1, '_id': 1}
        ))
    elif user_type == 'banned':
        # Banned users
        users = list(mongo.db.users.find(
            {'status': 'banned'},
            {'username': 1, 'last_ip': 1, '_id': 1}
        ))
    else:
        return jsonify({'status': 'error', 'message': 'Invalid user type'}), 400
    
    # Convert ObjectId to string for JSON serialization
    for user in users:
        user['_id'] = str(user['_id'])
    
    return jsonify({'users': users})

@app.route('/admin/user/<user_id>/chats')
@admin_required
@handle_db_errors
def get_user_chats(user_id):
    """Get all chat conversations for a specific user"""
    # Get user information
    user = mongo.db.users.find_one({'_id': ObjectId(user_id)})
    if not user:
        return jsonify({'status': 'error', 'message': 'User not found'}), 404
    
    username = user['username']
    
    # Get conversations
    conversations = list(mongo.db.conversations.find(
        {'username': username}
    ).sort('created_at', -1))
    
    # Format conversation data
    result = []
    for conv in conversations:
        conv_id = str(conv['_id'])
        # Get message count for this conversation
        message_count = mongo.db.chats.count_documents({'conversation_id': conv_id})
        # Get first message for preview
        first_message = mongo.db.chats.find_one(
            {'conversation_id': conv_id, 'username': username},
            sort=[('timestamp', 1)]
        )
        
        result.append({
            'conversation_id': conv_id,
            'created_at': conv['created_at'].strftime('%Y-%m-%d %H:%M:%S'),
            'message_count': message_count,
            'preview': first_message['message'][:50] + '...' if first_message and 'message' in first_message else 'No messages'
        })
    
    return jsonify({
        'username': username,
        'conversations': result
    })

@app.route('/admin/user/<user_id>/ban', methods=['POST'])
@admin_required
@handle_db_errors
def ban_user(user_id):
    """Ban a user"""
    user = mongo.db.users.find_one({'_id': ObjectId(user_id)})
    if not user:
        return jsonify({'status': 'error', 'message': 'User not found'}), 404
    
    if user['username'] == 'admin':
        return jsonify({'status': 'error', 'message': 'Cannot ban admin user'}), 403
    
    mongo.db.users.update_one(
        {'_id': ObjectId(user_id)},
        {'$set': {'status': 'banned'}}
    )
    
    return jsonify({'status': 'success', 'message': f"User {user['username']} has been banned"})

@app.route('/admin/user/<user_id>/unban', methods=['POST'])
@admin_required
@handle_db_errors
def unban_user(user_id):
    """Unban a user"""
    user = mongo.db.users.find_one({'_id': ObjectId(user_id)})
    if not user:
        return jsonify({'status': 'error', 'message': 'User not found'}), 404
    
    mongo.db.users.update_one(
        {'_id': ObjectId(user_id)},
        {'$set': {'status': 'active'}}
    )
    
    return jsonify({'status': 'success', 'message': f"User {user['username']} has been unbanned"})

@app.route('/admin/conversation/<conv_id>', methods=['DELETE'])
@admin_required
@handle_db_errors
def admin_delete_conversation(conv_id):
    """Delete a conversation as admin"""
    conversation = mongo.db.conversations.find_one({'_id': ObjectId(conv_id)})
    if not conversation:
        return jsonify({'status': 'error', 'message': 'Conversation not found'}), 404
    
    mongo.db.conversations.delete_one({'_id': ObjectId(conv_id)})
    mongo.db.chats.delete_many({'conversation_id': conv_id})
    
    return jsonify({'status': 'success', 'message': 'Conversation deleted'})

@app.before_request
def check_if_banned():
    """Check if the logged in user is banned"""
    if 'username' in session and session['username'] != 'admin':
        user = mongo.db.users.find_one({'username': session['username']})
        if user and user.get('status') == 'banned':
            session.clear()
            return render_template('login.html', error='Your account has been banned'), 403

# Add this function to initialize database with required fields
def initialize_database():
    """Ensure database has necessary collections and fields"""
    try:
        # Test connection first
        mongo.db.command('ping')
        app.logger.info("Connected to MongoDB successfully")
        
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
        
    except Exception as e:
        app.logger.error(f"Database initialization failed: {str(e)}")
        app.logger.error("Please check your MongoDB connection settings")

@app.route('/admin/conversation/<conv_id>/messages')
@admin_required
@handle_db_errors
def get_conversation_messages(conv_id):
    """Get all messages for a specific conversation"""
    # Verify conversation exists
    conversation = mongo.db.conversations.find_one({'_id': ObjectId(conv_id)})
    if not conversation:
        return jsonify({'status': 'error', 'message': 'Conversation not found'}), 404
    
    # Get all messages in this conversation
    messages = list(mongo.db.chats.find(
        {'conversation_id': conv_id}
    ).sort('timestamp', 1))
    
    # Format message data for JSON response
    result = []
    for msg in messages:
        result.append({
            'username': msg['username'],
            'message': msg['message'],
            'timestamp': msg['timestamp'].strftime('%Y-%m-%d %H:%M:%S'),
            'is_bot': msg['username'] == 'StaRK'
        })
    
    return jsonify({
        'conversation_id': conv_id,
        'user': conversation['username'],
        'messages': result
    })

# Add this to your app initialization
if __name__ == '__main__':
    initialize_database()
    server = Server(app.wsgi_app)
    server.serve(debug=True, port=9009)
