'use strict';
(function() {

    //This manages the chat window.
    const dataAccess = require('../../lib/common/data-access.js');

    angular
        .module('firebotApp')
        .factory('chatMessagesService', function (listenerService, settingsService) {
            let service = {};

            // Chat Message Queue
            service.chatQueue = [];

            // Chat User List
            service.chatUsers = [];

            // Sub Icon Cache
            service.subIconCache = false;

            // Poll Cache
            // This stores poll durations.
            service.pollCache = false;

            // Tells us if we should process in app chat or not.
            service.getChatFeed = function() {
                return settingsService.getRealChatFeed();
            };

            // Return the chat queue.
            service.getChatQueue = function() {
                return service.chatQueue;
            };

            // Clear Chat Queue
            service.clearChatQueue = function() {
                service.chatQueue = [];
            };

            // Return User List
            service.getChatUsers = function () {
                // Sort list so we are in alphabetical order
                let userList = service.chatUsers;
                if (userList.length > 0) {
                    userList.sort(function(a, b) {
                        return a.username.localeCompare(b.username);
                    });
                }
                return userList;
            };

            // Clear User List
            service.clearUserList = function () {
                service.chatUsers = [];
            };

            // Full Chat User Refresh
            // This replaces chat users with a fresh list pulled from the backend in the chat processor file.
            service.chatUserRefresh = function (data) {
                service.chatUsers = data.chatUsers;
            };

            // User joined the channel.
            service.chatUserJoined = function (data) {
                service.chatUsers.push(data);
            };

            // User left the channel.
            service.chatUserLeft = function (data) {
                let username = data.username,
                    arr = service.chatUsers,
                    userList = arr.filter(x => x.username !== username);

                console.log(userList);
                service.chatUsers = userList;
            };

            // Delete Chat Message
            service.deleteChatMessage = function(data) {
                let arr = service.chatQueue,
                    message = arr.find(message => message.id === data.id);
                message.deleted = true;
                message.eventInfo = "Deleted by " + data.moderator.user_name + '.';
            };

            // Purge Chat Message
            service.purgeChatMessages = function(data) {
                let chatQueue = service.chatQueue;

                Object.keys(chatQueue).forEach((key) => {
                    let message = chatQueue[key];

                    // If user id matches, then mark the message as deleted.
                    if (message.user_id === data.user_id) {
                        message.deleted = true;
                        message.eventInfo = "Purged by " + data.moderator.user_name + '.';
                    }
                });
            };

            // Chat Alert Message
            service.chatAlertMessage = function(message) {
                let data = {
                    id: "System",
                    user_name: "System", // eslint-disable-line
                    user_roles: [ // eslint-disable-line
                        "System"
                    ],
                    user_avatar: "../images/logo.jpg", // eslint-disable-line
                    message: {
                        meta: {
                            me: true
                        }
                    },
                    messageHTML: message
                };
                service.chatQueue.push(data);
            };

            // Poll Update
            // This is fired when a poll starts or is updated.
            // Mixer fires this every second or so, but we only display chat alerts every 30 seconds.
            service.pollUpdate = function(data) {
                // If we aren't running a poll, display data right away. Otherwise display update every 30 seconds.
                if (service.pollCache === false || service.pollCache >= data.duration + 30000) {
                    let votes = data.responses,
                        stringHolder = [],
                        answers = [];

                    // Parse vote data so we can form a string out of it.
                    Object.keys(votes).forEach((key) => {
                        stringHolder.push(key + ' (' + votes[key] + ' votes)');
                    });

                    // If more than one answer, join it together into a string.
                    if (stringHolder.length > 1) {
                        answers = stringHolder.join(', ');
                    } else {
                        answers = stringHolder[0];
                    }

                    service.chatAlertMessage(data.author.user_name + ' is running a poll. Question: ' + data.q + '. Answers: ' + answers + '.');

                    // Update Poll Cache
                    service.pollCache = data.duration;
                }
            };

            // Poll End
            // This will find the winner(s) and output an alert to chat.
            service.pollEnd = function(data) {
                let answers = data.responses,
                    winners = [],
                    winnerVotes = 0;
                Object.keys(answers).forEach((key) => {
                    let answerVotes = answers[key];
                    if (answerVotes === winnerVotes) {
                        // We have a tie, push to the winner array.
                        winners.push(key);
                        winnerVotes = answerVotes;
                    } else if (answerVotes > winnerVotes) {
                        // This one has more votes. Clear winner array so far and push this one in there.
                        winners = [];
                        winners.push(key);
                        winnerVotes = answerVotes;
                    }
                });
                winners = winners.join(", ");
                service.chatAlertMessage(data.author.user_name + '\'s poll has ended. Question: ' + data.q + '. Winner(s): ' + winners + '.');

                // Clear poll cache.
                service.pollCache = false;
            };

            // Chat Update Handler
            // This handles all of the chat stuff that isn't a message.
            // This will only work when chat feed is turned on in the settings area.
            service.chatUpdateHandler = function(data) {
                if (settingsService.getRealChatFeed() === true) {
                    switch (data.fbEvent) {
                    case "ClearMessage":
                        console.log('Chat cleared');
                        service.clearChatQueue();
                        service.chatAlertMessage('Chat has been cleared by ' + data.clearer.user_name + '.');
                        break;
                    case "DeleteMessage":
                        console.log('Chat message deleted');
                        service.deleteChatMessage(data);
                        break;
                    case "PurgeMessage":
                        console.log('Chat message purged');
                        service.purgeChatMessages(data);
                        break;
                    case "UserTimeout":
                        console.log('Chat user timed out');
                        console.log(data);
                        service.chatAlertMessage(data.user.username + ' has been timed out for ' + data.user.duration + '.');
                        break;
                    case "PollStart":
                        service.pollUpdate(data);
                        break;
                    case "PollEnd":
                        service.pollEnd(data);
                        break;
                    case "UserJoin":
                        console.log('Chat User Joined');

                        // Standardize user roles naming.
                            data.user_roles = data.roles; // eslint-disable-line

                        service.chatUserJoined(data);
                        break;
                    case "UserLeave":
                        console.log('Chat User Left');
                        console.log(data);

                        // Standardize user roles naming.
                            data.user_roles = data.roles; // eslint-disable-line

                        service.chatUserLeft(data);
                        break;
                    case "UserUpdate":
                        console.log('User updated');
                        console.log(data);
                        break;
                    case "Disconnected":
                        // We disconnected. Clear messages, post alert, and then let the reconnect handle repopulation.
                        console.log('Chat Disconnected!');
                        console.log(data);
                        service.clearChatQueue();
                        service.chatAlertMessage('Chat has been disconnected.');
                        break;
                    case "UsersRefresh":
                        console.log('Chat userlist refreshed.');
                        service.chatUserRefresh(data);
                        break;
                    case "ChatAlert":
                        console.log('Chat alert from backend.');
                        service.chatAlertMessage(data.message);
                        break;
                    default:
                        // Nothing
                        console.log('Unknown chat event sent');
                        console.log(data);
                    }
                }
                return;
            };

            // Prune Messages
            // This checks the chat queue and purges anything over 200 messages.
            service.chatPrune = function() {
                let arr = service.chatQueue;
                if (arr.length > 200) {
                    arr.splice(0, 1);
                }
            };

            service.getSubIcon = function() {
                if (service.subIconCache !== false) {
                    // Check to see if we've cached the icon yet. If we have, use it.
                    return service.subIconCache;
                }

                // We haven't cached the icon yet, lets do that.
                let dbAuth = dataAccess.getJsonDbInUserData("/user-settings/auth"),
                    streamer = dbAuth.getData('/streamer'),
                    subIcon = [];

                try {
                    // If this runs it means we have saved it to the auth file.
                    subIcon = dbAuth.getData('/streamer/subBadge');
                    service.subIconCache = subIcon;
                    return service.subIconCache;
                } catch (err) {
                    // If this runs it means we've never saved the sub badge.
                    request({
                        url: 'https://mixer.com/api/v1/channels/' + streamer.username + '?fields=badge,partnered'
                    }, function (err, res) {
                        let data = JSON.parse(res.body);

                        // Push all to db.
                        if (data.partnered === true) {
                            dbAuth.push('./streamer/subBadge', data.badge.url);
                            service.subIconCache = data.badge.url;
                        }

                        return service.subIconCache;
                    });
                }
            };

            // Watches for an chat message from main process
            // Pushes it to chat queue when it is recieved.
            listenerService.registerListener(
                { type: listenerService.ListenerType.CHAT_MESSAGE },
                (data) => {

                    if (data.user_avatar === null || data.user_avatar === undefined) {
                        data.user_avatar = "https://mixer.com/_latest/assets/images/main/avatars/default.jpg"; // eslint-disable-line
                    }

                    // Push new message to queue.
                    service.chatQueue.push(data);

                    // Trim messages over 200.
                    service.chatPrune();
                });

            // Watches for an chat update from main process
            // This handles clears, deletions, timeouts, etc... Anything that isn't a message.
            listenerService.registerListener(
                { type: listenerService.ListenerType.CHAT_UPDATE },
                (data) => {
                    service.chatUpdateHandler(data);
                });

            return service;
        });
}());
