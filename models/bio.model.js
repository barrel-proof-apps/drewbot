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

ModelSchema
	.path('details')
	.validate(function(bio) {
		return bio && bio.length > 0;
	}, 'Bio cannot be blank');

module.exports = mongoose.model('Bio', ModelSchema);
