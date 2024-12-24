"use strict";

const utils = require("./utils");
const log = require("npmlog");
const fs = require('fs');
const Server = require("@igorkowalczyk/repl-uptime");
const gradient = require("gradient-string");

const checkVerified = null;

const defaultLogRecordSize = 100;
log.maxRecordSize = defaultLogRecordSize;

const chalk = require('chalk');

const error = chalk.bold.red;
const warning = chalk.hex('#FFA500');
const success = chalk.greenBright;

const configContent = `
module.exports = {
    MainName: "[ FCA-ORION ]",
    AutoUpdate: true
};
`;

const configPath = 'config.js';

if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, configContent);
}

const { MainName } = require("../../config.js");
const InstantUpdate = require('./instantUpdate.js');

function setOptions(globalOptions, options) {
    Object.keys(options).map(function (key) {
        switch (key) {
            case 'online':
                globalOptions.online = Boolean(options.online);
                break;
            case 'logLevel':
                log.level = options.logLevel;
                globalOptions.logLevel = options.logLevel;
                break;
            case 'logRecordSize':
                log.maxRecordSize = options.logRecordSize;
                globalOptions.logRecordSize = options.logRecordSize;
                break;
            case 'selfListen':
                globalOptions.selfListen = Boolean(options.selfListen);
                break;
            case 'selfListenEvent':
                globalOptions.selfListenEvent = options.selfListenEvent;
                break;
            case 'listenEvents':
                globalOptions.listenEvents = Boolean(options.listenEvents);
                break;
            case 'pageID':
                globalOptions.pageID = options.pageID.toString();
                break;
            case 'updatePresence':
                globalOptions.updatePresence = Boolean(options.updatePresence);
                break;
            case 'forceLogin':
                globalOptions.forceLogin = Boolean(options.forceLogin);
                break;
            case 'userAgent':
                globalOptions.userAgent = options.userAgent;
                break;
            case 'autoMarkDelivery':
                globalOptions.autoMarkDelivery = Boolean(options.autoMarkDelivery);
                break;
            case 'autoMarkRead':
                globalOptions.autoMarkRead = Boolean(options.autoMarkRead);
                break;
            case 'listenTyping':
                globalOptions.listenTyping = Boolean(options.listenTyping);
                break;
            case 'proxy':
                if (typeof options.proxy != "string") {
                    delete globalOptions.proxy;
                    utils.setProxy();
                } else {
                    globalOptions.proxy = options.proxy;
                    utils.setProxy(globalOptions.proxy);
                }
                break;
            case 'autoReconnect':
                globalOptions.autoReconnect = Boolean(options.autoReconnect);
                break;
            case 'emitReady':
                globalOptions.emitReady = Boolean(options.emitReady);
                break;
            default:
                console.log(gradient('orange', 'yellow')('setOptions') + warning("Unrecognized option given to setOptions: " + key));
                break;
        }
    });
}

function buildAPI(globalOptions, html, jar) {
    const maybeCookie = jar.getCookies("https://www.facebook.com").filter(function (val) {
        return val.cookieString().split("=")[0] === "c_user";
    });

    const objCookie = jar.getCookies("https://www.facebook.com").reduce(function (obj, val) {
        obj[val.cookieString().split("=")[0]] = val.cookieString().split("=")[1];
        return obj;
    }, {});

    if (maybeCookie.length === 0) {
        throw { error: "Error retrieving userID. This can be caused by a lot of things, including getting blocked by Facebook for logging in from an unknown location. Try logging in with a browser to verify." };
    }

    if (html.indexOf("/checkpoint/block/?next") > -1) {
        console.log(warning("Checkpoint detected. Please log in with a browser to verify."));
    }

    console.log(gradient('orange', 'yellow').multiline(["▒█▀▄▒█▀▄░▄▀▄░░▒█▒██▀░▄▀▀░▀█▀░░░▄▀▄▒█▀▄░█░▄▀▄░█▄░█", "░█▀▒░█▀▄░▀▄▀░▀▄█░█▄▄░▀▄▄░▒█▒▒░░▀▄▀░█▀▄░█░▀▄▀░█▒▀█",].join('\n')));
    console.log('');

    const userID = maybeCookie[0].cookieString().split("=")[1].toString();
    const i_userID = objCookie.i_user || null;
    const localVersion = require('./package.json').version;
    console.log(gradient('orange', 'yellow')(`${MainName || "[ FCA-ORION ]"}`) + chalk.white(` Logged in as ${userID}`));
    console.log(gradient('orange', 'yellow')(`${MainName || "[ FCA-ORION ]"}`) + chalk.white(` The version of FCA-ORION you currently have is`) + chalk.greenBright(` ${localVersion}`));

    try {
        clearInterval(checkVerified);
    } catch (_) { }

    const clientID = (Math.random() * 2147483648 | 0).toString(16);

    let mqttEndpoint = null;
    let region = null;
    let irisSeqID = null;
    let noMqttData = null;

    // Attempt to match the new format first
    const newFBMQTTMatch = html.match(/{"app_id":"219994525426954","endpoint":"(.+?)","iris_seq_id":"(.+?)"}/);
    if (newFBMQTTMatch) {
        irisSeqID = newFBMQTTMatch[2];
        mqttEndpoint = newFBMQTTMatch[1].replace(/\\\//g, "/");
        region = new URL(mqttEndpoint).searchParams.get("region").toUpperCase();
        console.log(gradient('orange', 'yellow')(`${MainName || "[ FCA-ORION ]"}`) + chalk.white(` Got this account's message region: ${region}`));
    } else {
        // Fallback to the old format if the new one fails
        const oldFBMQTTMatch = html.match(/irisSeqID:"(.+?)",appID:219994525426954,endpoint:"(.+?)"/);
        if (oldFBMQTTMatch) {
            irisSeqID = oldFBMQTTMatch[1];
            mqttEndpoint = oldFBMQTTMatch[2];
            region = new URL(mqttEndpoint).searchParams.get("region").toUpperCase();
            console.log(gradient('orange', 'yellow')(`${MainName || "[ FCA-ORION ]"}`) + chalk.white(` Got this account's message region: ${region}`));
        } else {
            // Fallback to the legacy format if both new and old formats fail
            const legacyFBMQTTMatch = html.match(/(\["MqttWebConfig",\[\],{fbid:")(.+?)(",appID:219994525426954,endpoint:")(.+?)(",pollingEndpoint:")(.+?)(3790])/);
            if (legacyFBMQTTMatch) {
                mqttEndpoint = legacyFBMQTTMatch[4];
                region = new URL(mqttEndpoint).searchParams.get("region").toUpperCase();
                console.log(warning('Cannot get sequence ID with new RegExp. Fallback to old RegExp (without seqID)...'));
                console.log(gradient('orange', 'yellow')(`${MainName || "[ FCA-ORION ]"}`) + chalk.white(` Got this account's message region: ${region}`));
                console.log(gradient('orange', 'yellow')(`${MainName || "[ FCA-ORION ]"}`) + chalk.white(` [Unused] Polling endpoint: ${legacyFBMQTTMatch[6]}`));
            } else {
                console.log(warning('Cannot get MQTT region & sequence ID.'));
                noMqttData = html;
            }
        }
    }

    // All data available to api functions
    const ctx = {
        userID: userID,
        i_userID: i_userID,
        jar: jar,
        clientID: clientID,
        globalOptions: globalOptions,
        loggedIn: true,
        access_token: 'NONE',
        clientMutationId: 0,
        mqttClient: undefined,
        lastSeqId: irisSeqID,
        syncToken: undefined,
        mqttEndpoint,
        region,
        firstListen: true
    };

    const api = {
        setOptions: setOptions.bind(null, globalOptions),
        getAppState: function getAppState() {
            const appState = utils.getAppState(jar);
            // filter duplicate
            return appState.filter((item, index, self) => self.findIndex((t) => { return t.key === item.key; }) === index);
        }
    };

    if (noMqttData) {
        api["htmlData"] = noMqttData;
    }

    const apiFuncNames = [
        'addExternalModule',
        'addUserToGroup',
        'changeAdminStatus',
        'changeArchivedStatus',
        'changeAvatar',
        'changeBio',
        'changeBlockedStatus',
        'changeGroupImage',
        'changeNickname',
        'changeThreadColor',
        'changeThreadEmoji',
        'createNewGroup',
        'createPoll',
        'deleteMessage',
        'deleteThread',
        'forwardAttachment',
        'getCurrentUserID',
        'getEmojiUrl',
        'getFriendsList',
        'getMessage',
        'getThreadHistory',
        'getThreadInfo',
        'getThreadList',
        'getThreadPictures',
        'getUserID',
        'getUserInfo',
        'handleMessageRequest',
        'listenMqtt',
        'logout',
        'markAsDelivered',
        'markAsRead',
        'markAsReadAll',
        'markAsSeen',
        'muteThread',
        'refreshFb_dtsg',
        'removeUserFromGroup',
        'resolvePhotoUrl',
        'searchForThread',
        'sendMessage',
        'sendTypingIndicator',
        'setMessageReaction',
        'setPostReaction',
        'setTitle',
        'threadColors',
        'unsendMessage',
        'unfriend',

        // HTTP
        'httpGet',
        'httpPost',
        'httpPostFormData',

        'uploadAttachment'
    ];

    const defaultFuncs = utils.makeDefaults(html, i_userID || userID, ctx);

    // Load all api functions in a loop
    apiFuncNames.map(function (v) {
        api[v] = require('./src/' + v)(defaultFuncs, api, ctx);
    });

    //Removing original `listen` that uses pull.
    //Map it to listenMqtt instead for backward compatibly.
    api.listen = api.listenMqtt;

    return [ctx, defaultFuncs, api];
}

// Helps the login
function loginHelper(appState, email, password, globalOptions, callback, prCallback) {
    let mainPromise = null;
    const jar = utils.getJar();

    // If we're given an appState we loop through it and save each cookie
    // back into the jar.
    if (appState) {
        // check and convert cookie to appState
        if (utils.getType(appState) === 'Array' && appState.some(c => c.name)) {
            appState = appState.map(c => {
                c.key = c.name;
                delete c.name;
                return c;
            });
        }
        else if (utils.getType(appState) === 'String') {
            const arrayAppState = [];
            appState.split(';').forEach(c => {
                const [key, value] = c.split('=');

                arrayAppState.push({
                    key: (key || "").trim(),
                    value: (value || "").trim(),
                    domain: "facebook.com",
                    path: "/",
                    expires: new Date().getTime() + 1000 * 60 * 60 * 24 * 365
                });
            });
            appState = arrayAppState;
        }

        appState.map(function (c) {
            const str = c.key + "=" + c.value + "; expires=" + c.expires + "; domain=" + c.domain + "; path=" + c.path + ";";
            jar.setCookie(str, "http://" + c.domain);
        });

        // Load the main page.
        mainPromise = utils
            .get('https://www.facebook.com/', jar, null, globalOptions, { noRef: true })
            .then(utils.saveCookies(jar));
    } else {
        if (email) {
            throw { error: "Currently, the login method by email and password is no longer supported, please use the login method by appState" };
        }
        else {
            throw { error: "No appState given." };
        }
    }

    let ctx = null;
    let _defaultFuncs = null;
    let api = null;

    mainPromise = mainPromise
        .then(function (res) {
            // Hacky check for the redirection that happens on some ISPs, which doesn't return statusCode 3xx
            const reg = /<meta http-equiv="refresh" content="0;url=([^"]+)[^>]+>/;
            const redirect = reg.exec(res.body);
            if (redirect && redirect[1]) {
                return utils
                    .get(redirect[1], jar, null, globalOptions)
                    .then(utils.saveCookies(jar));
            }
            return res;
        })
        .then(function (res) {
            const html = res.body;
            const stuff = buildAPI(globalOptions, html, jar);
            ctx = stuff[0];
            _defaultFuncs = stuff[1];
            api = stuff[2];
            return res;
        });

    // given a pageID we log in as a page
    if (globalOptions.pageID) {
        mainPromise = mainPromise
            .then(function () {
                return utils
                    .get('https://www.facebook.com/' + ctx.globalOptions.pageID + '/messages/?section=messages&subsection=inbox', ctx.jar, null, globalOptions);
            })
            .then(function (resData) {
                let url = utils.getFrom(resData.body, 'window.location.replace("https:\\/\\/www.facebook.com\\', '");').split('\\').join('');
                url = url.substring(0, url.length - 1);

                return utils
                    .get('https://www.facebook.com' + url, ctx.jar, null, globalOptions);
            });
    }

    // At the end we call the callback or catch an exception
    mainPromise
        .then(function () {
            console.log(gradient('orange', 'yellow')(`${MainName || "[ FCA-ORION ]"}`) + chalk.white(` Done logging in.`));
            return callback(null, api);
        })
        .catch(function (e) {
            console.log(error(e.error || e));
            callback(e);
        });
}

function login(loginData, options, callback) {
    if (utils.getType(options) === 'Function' || utils.getType(options) === 'AsyncFunction') {
        callback = options;
        options = {};
    }

    const globalOptions = {
        selfListen: false,
        selfListenEvent: false,
        listenEvents: false,
        listenTyping: false,
        updatePresence: false,
        forceLogin: false,
        autoMarkDelivery: true,
        autoMarkRead: false,
        autoReconnect: true,
        logRecordSize: defaultLogRecordSize,
        online: true,
        emitReady: false,
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_2) AppleWebKit/600.3.18 (KHTML, like Gecko) Version/8.0.3 Safari/600.3.18"
    };

    setOptions(globalOptions, options);

    let prCallback = null;
    if (utils.getType(callback) !== "Function" && utils.getType(callback) !== "AsyncFunction") {
        let rejectFunc = null;
        let resolveFunc = null;
        var returnPromise = new Promise(function (resolve, reject) {
            resolveFunc = resolve;
            rejectFunc = reject;
        });
        prCallback = function (error, api) {
            if (error) {
                return rejectFunc(error);
            }
            return resolveFunc(api);
        };
        callback = prCallback;
    }
    loginHelper(loginData.appState, loginData.email, loginData.password, globalOptions, callback, prCallback);
    return returnPromise;
}

new Server({
    port: 8080,
    path: "/",
    message: "🤙 Don't let your repl go to sleep!",
    debug: true,
});

InstantUpdate();
module.exports = login;
