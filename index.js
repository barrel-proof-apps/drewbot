var dotenv = require("dotenv"),
	RtmClient = require('@slack/client').RtmClient,
	mongoose = require("mongoose"),
	_ = require("underscore");

dotenv.config();
var token = process.env.SLACK_API_TOKEN || '';

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
	var usage = {
		bio: "\"bio <target>\" where target is me, all, or a @username.  ex:\n\tbio me\n\tbio all\n\tbio @az",
		setbio: "\"setbio <bio>\" where bio is your company details  ex:\n\tsetbio Barrel Proof apps is a A craft consulting agency specializing in mobile, web, cloud, and IoT solutions.'",
	}
	var bioUsage = "Please use the following notation " + usage.bio;

	controller.hears(["usage"], ["direct_mention", "mention", "direct_message"], function(bot, message) {
		_.each(_.values(usage), function(cmd){
			bot.reply(message, cmd);
		})
	})
	function renderBio(bio) {
		var fullName = `${bio.firstName|| ""} ${bio.lastName ||""}`;
		var title = bio.title ||"";
		var result = `<@${bio.userid}> ${fullName!=" " ? fullName : ""}${bio.title !="" ? ", "+ bio.title : ""}`
		var skype = bio.skype ||"", phone = bio.phone ||"";
		if (skype != "" || phone != "")
			result = result + `\n\t${bio.skype && bio.skype!="" ? "skype: " +bio.skype + " | " : ""}${bio.phone && bio.phone!="" ? "tel:"+bio.phone : ""}`;
		result= result + `\n\t${bio.details}`;
		return result;
	}
	controller.hears(["^bio"], ["direct_message", "direct_mention", "mention", "ambient"], function(bot, message) {
		try {
			var name = message.text.split(" ")[1];
		} catch(e) {
			console.log(e);
			return bot.reply(message, bioUsage);
		}

		if (!name) {
			bot.reply(message, bioUsage);
		} else if (name == "me") {
			Bio.findOne({
				userid: message.user
			}).then(function(bio){
				if (!bio) {
					bot.reply(message, 'Your bio is empty, use ' +usage.setbio);
				} else {
					bot.reply(message, renderBio(bio));
				}
			}).catch(function(e){
				console.log(e)
				bot.reply(message, bioUsage);
			})
		} else if (name == "all") {
			Bio.find().then(function(bios){
				_.each(bios, function(bio){
					bot.reply(message, renderBio(bio));
				})
			}).catch(function(e){
				console.log(e)
				bot.reply(message, bioUsage);
			})
		} else {
			if (name.indexOf("<@") == -1 ) {
				bot.reply(message, bioUsage);
			} else {
				var userid = name.replace(/[<>@]*/g, "")
				Bio.findOne({
					userid: userid
				}).then(function(bio){
					if (!bio) {
						bot.reply(message, `The bio is empty, tell <@${userid}> to use ${usage.setbio}`);
					} else {
						bot.reply(message, bio.details);
					}
				}).catch(function(e){
					bot.reply(message, bioUsage);
					console.log(e)
				})
			}
		}
	});
	controller.hears(["^setbio"], ["direct_message", "direct_mention", "mention", "ambient"], function(bot, message) {
		var userParams = null;
		wrapApi(bot.api.users.info, {
			user: message.user
		}).then(function(payload) {
			var user = payload.user;
			userParams = {
				userid: message.user,
				username: user.name,
				email: user.profile.email,
				avatar: user.profile.image_original,
				phone: user.profile.phone,
				firstName: user.profile.first_name,
				lastName: user.profile.last_name,
				title: user.profile.title,
				skype: user.profile.skype,
				details: message.text.replace(/setbio */i, "")
			};
			return Bio.findOne({
				userid: message.user
			})
		}).then(function(bio){
			if (!bio) {
				return new Bio(userParams).save();
			} else {
				_.each(_.keys(userParams), function(key){
					bio[key] = userParams[key];
				})
				return bio.save();
			}
		}).then(function(bio){
			bot.reply(message, `bio saved`);
		}).catch(function(e){
			console.log(e)
			bot.reply(message, "invalid usage, please use "+usage.setbio)
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