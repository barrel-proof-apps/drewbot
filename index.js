var dotenv = require("dotenv"),
	RtmClient = require('@slack/client').RtmClient,
	mongoose = require("mongoose"),
	_ = require("underscore");

dotenv.config();
var token = process.env.SLACK_API_TOKEN || '';

function setupSlackNode() {
	console.log(token)

	var rtm = new RtmClient(token, {
		logLevel: 'debug'
	});
	rtm.start();


	var RTM_EVENTS = require('@slack/client').RTM_EVENTS;
	console.log("setting up listen")
	rtm.on(RTM_EVENTS.MESSAGE, function(message) {
		console.log("recieved message " + JSON.stringify(message))
	});
	console.log('listening')
}
function wrapApi(f, options) {
	return new Promise(function(resolve, recject){
		f.call(null, options, function(err, payload){
			if (err) {
				reject(err)
			} else {
				resolve(payload)
			}
		})
	});
}
function setupBotkit() {
	var Botkit = require('botkit');
	var controller = Botkit.slackbot();
	var bot = controller.spawn({
		token: token
	})
	bot.startRTM(function(err, bot, payload) {
		if (err) {
			throw new Error('Could not connect to Slack');
		}
	});
	var Bio = require('./models/bio.model');
	var bioUsage = `Please use the following notation "bio <target>" where target is me, all, or a username.  ex:
	bio me
	bio all
	bio @az`;

	controller.hears(["^bio"], ["direct_message", "direct_mention", "mention", "ambient"], function(bot, message) {
		console.log(JSON.stringify(message))
		try {
			var name = message.text.split(" ")[1];
			console.log("success name is "+name)
		} catch(e) {
			console.log("error")
			console.log(e);
			bot.reply(message, bioUsage);
			return;
		}

		if (!name) {
			bot.reply(message, bioUsage);
		} else if (name == "me") {
			Bio.findOne({
				userid: message.user
			}).then(function(bio){
				if (!bio) {
					bot.reply(message, 'Your bio is empty, use "setbio <details>" to set.  ex: \nsetbio Barrel Proof apps is a A craft consulting agency specializing in mobile, web, cloud, and IoT solutions.');
				} else {
					bot.reply(message, bio.details);
				}
			}).catch(function(e){
				console.log(e)
			})
		} else if (name == "all") {
			Bio.find().then(function(bios){
				_.each(bios, function(bio){
					bot.reply(message, `<@${bio.userid}> ${bio.details}`);
				})
			}).catch(function(e){
				console.log(e)
			})
		} else {
			var userid = name.replace(/[<>@]*/g, "")
			Bio.findOne({
				userid: userid
			}).then(function(bio){
				if (!bio) {
					bot.reply(message, `The bio is empty, tell <@${userid}> to "setbio <details>" to set.  ex: \nsetbio Barrel Proof apps is a A craft consulting agency specializing in mobile, web, cloud, and IoT solutions.`);
				} else {
					bot.reply(message, bio.details);
				}
			}).catch(function(e){
				console.log(e)
			})
		}
	});
	controller.hears(["^setbio"], ["direct_message", "direct_mention", "mention", "ambient"], function(bot, message) {
		var user = null;
		wrapApi(bot.api.users.info, {
			user: message.user
		}).then(function(payload) {
			user = _.pick(payload.user, "name", "profile");
			return Bio.findOne({
				userid: message.user
			})
		}).then(function(bio){
			if (!bio) {
				return new Bio({
					userid: message.user,
					username: user.name,
					email: user.profile.email,
					avatar: user.profile.image_original,
					details: message.text.replace("setbio ", "")
				}).save();
			} else {
				bio.details = message.text.replace("setbio ", "");
				return bio.save();
			}
		}).then(function(bio){
			console.log("saved")
			bot.reply(message, `bio saved`);
		}).catch(function(e){
			console.log(e)
		})
	});
}

function setupMongo() {
	mongoose.connect(process.env.MONGO_URI, {
		db: {
			safe: true
		}
	});
	mongoose.connection.on('error', function(err) {
		console.error('MongoDB connection error: ' + err);
		process.exit(-1);
	});
}
setupMongo();
setupBotkit()