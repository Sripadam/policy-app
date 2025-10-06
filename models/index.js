const mongoose = require('mongoose');

// 1. Agent Schema ---
const AgentSchema = new mongoose.Schema({
    agent_name: { type: String, required: true },
});
exports.Agent = mongoose.model('Agent', AgentSchema);

//  2. User Schema ---
const UserSchema = new mongoose.Schema({
    first_name: { type: String, required: true },
    dob: { type: Date },
    address: { type: String },
    phone_number: { type: String },
    state: { type: String },
    zip_code: { type: String },
    email: { type: String, required: true, unique: true },
    gender: { type: String },
    userType: { type: String },
});
exports.User = mongoose.model('User', UserSchema);

//  3. User's Account Schema ---
const AccountSchema = new mongoose.Schema({
    account_name: { type: String, required: true },
    // Reference to User
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
});
exports.Account = mongoose.model('Account', AccountSchema, 'Users_Account');

//  4. Policy Category (LOB) Schema ---
const LOBSchema = new mongoose.Schema({
    category_name: { type: String, required: true, unique: true },
});
exports.LOB = mongoose.model('LOB', LOBSchema, 'LOB');

//  5. Policy Carrier Schema ---
const CarrierSchema = new mongoose.Schema({
    company_name: { type: String, required: true, unique: true },
});
exports.Carrier = mongoose.model('Carrier', CarrierSchema, 'Carrier');

//  6. Policy Info Schema ---
const PolicySchema = new mongoose.Schema({
    policy_number: { type: String, required: true, unique: true },
    policy_start_date: { type: Date },
    policy_end_date: { type: Date },
    
    // References for relationships
    policy_category_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LOB', required: true }, 
    company_collection_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Carrier', required: true }, 
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    agent_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', required: true },
    account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
});
exports.Policy = mongoose.model('Policy', PolicySchema, 'Policy');

//  7. Messages Schema ---
const MessageSchema = new mongoose.Schema({
    message: { type: String, required: true },
    scheduledAt: { type: Date, required: true },
    insertedAt: { type: Date, default: Date.now },
});
exports.ScheduledMessage = mongoose.model('ScheduledMessage', MessageSchema, 'ScheduledMessages');