'use strict';

var mongoose = require('mongoose'),
	Schema = mongoose.Schema;

var ModelSchema = new Schema({
	userid: String,
	username: String,
	email: String,
	details: String,
	avatar: String
});

// ModelSchema
// 	.path('username')
// 	.validate(function(name) {
// 		return name && name.length > 0;
// 	}, 'Username cannot be blank');

ModelSchema
	.path('details')
	.validate(function(bio) {
		return bio && bio.length > 0;
	}, 'Bio cannot be blank');

module.exports = mongoose.model('Bio', ModelSchema);
