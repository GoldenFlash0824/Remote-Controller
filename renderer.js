const serverURL = "https://ns-server.vantagemdm.com";
const mdmServerURL = "https://ns-mdm.vantagemdm.com:8553/mdm";
const phpUrl = "ns-cp.vantagemdm.com";
const deviceKey = 'mikhioekobmenlckiimcmmjbomcgcigm';
const resellerId = "VantageMDM";
const buildVersion = "CHROME-R-1.0.6";
const ChromeVersion = (/Chrome\/([0-9]+)/.exec(navigator.userAgent) || [, 0])[1];
const agent = "screenSharing";
const platform = "chrome";
const browser = "Chrome";
/*** WEB SERVICES ****/
const socketUrl = "https://p2p.vantagemdm.com:8890";
const signUpUrl = serverURL + "/secure/device/subscribe";
const subcribeUrl = serverURL + "/secure/mdm/validate/user";
const fileUploadUrl = serverURL + "/secure/upload/file";
const getSettingsUrl = mdmServerURL + "/get/device/settings";
const getCallBackUrl = mdmServerURL + "/commands/status/completed?productName=" + resellerId;
let socket;
let mappingid = null;
let iceServers = [];
let inCandidates = [];
let outCandidates = [];
let connection = null;
let answerReceived = false;
let viewer = null;
let message = null;
let stream = null;
let mediaStream = null;
let streamstatus = null;
document.addEventListener('DOMContentLoaded', () => {
    connect();
    const startButton = document.getElementById('startButton');
    const stopButton = document.getElementById('stopButton');
    window.api.getItem('screensharing').then((data) => {
        console.log(data);
        if (data === 'start') {
            startButton.disabled = true;
            initStreaming();
            startStreaming();
        }
        else
            stopButton.disabled = true;
    });
    const connectButton = document.getElementById('connectBtn');
    if (connectButton) {
        connectButton.addEventListener('click', async () => {
            let jsonData = "";
            let jsonObject = {
                userName: "",
                password: document.getElementById('serialKey').value,
                resellerId: "VantageMDM",
                deviceKey: deviceKey,
                platform: platform,
                productVersion: buildVersion,
                productName: resellerId,
                timeZoneOffset: 0,
                udid: deviceKey,
                ChromeVersion: ChromeVersion,
                serial: ChromeVersion,
                agent: agent,
                browser: browser,
            };
            const formData = JSON.stringify(jsonObject);
            const myHeaders = new Headers();
            myHeaders.append("Content-Type", "application/x-www-form-urlencoded");
            const urlencoded = new URLSearchParams();
            urlencoded.append("formData", formData);
            const requestOptions = {
                method: "POST",
                headers: myHeaders,
                body: urlencoded,
                redirect: "follow",
            };
            jsonData = {
                mappingId: 'da414505-148f-46b4-b2f9-b66eb41514e2',
                code: '100',
                screenCastingURL: 'https://ippcscreenshot2.vantagemdm.com/screen/hmuwti',
                rtmpUrl: undefined,
                deviceId: undefined,
                mdmUrl: undefined,
                deviceName: undefined,
                deviceKey: '69887E3CBAF27F4C8A31A9C1008044A0',
                productVersion: buildVersion,
                protocol: 'wss',
                port: 443,
                host: 'streaming.vantagemdm.com',
                streamMode: "live",
                companyUrl: 'ippcscreenshot2.vantagemdm.com',
                companyName: 'ippcscreenshot2',
            };
            await window.api.setItem('mappingData', JSON.stringify(jsonData));
            await window.api.setItem('mappingId', jsonData.mappingId);
            await window.api.setItem('deviceKey', jsonData.deviceKey);
            await window.api.setItem('VantageMDMScreenCastingConnect', true);
            window.api.getItem('mappingData').then((data) => {
                console.log('mappingData:', JSON.parse(data));
            });
            window.api.getItem('mappingId').then((data) => {
                console.log('mappingId:', data);
            });
            window.api.getItem('deviceKey').then((data) => {
                console.log('deviceKey:', data);
            });
            window.api.getItem('VantageMDMScreenCastingConnect').then((data) => {
                console.log('VantageMDMScreenCastingConnect:', data);
            });
            window.api.loadOtherHtml('main.html');
        });
    }
    if (startButton) {
        startButton.addEventListener('click', async () => {
            console.log('start');
            initStreaming();
            startStreaming();
            window.api.setItem('screensharing', "start");
            startButton.disabled = true;
            stopButton.disabled = false;
        });
        // connect();
    }
    if (stopButton) {
        stopButton.addEventListener('click', async () => {
            console.log('stop');
            window.api.setItem('screensharing', 'stop');
            startButton.disabled = false;
            stopButton.disabled = true;
            stopStreaming();
        });
    }
});
function connect(callback) {
    window.api.getItem('mappingId').then((data) => {
        mappingid = data;
    });
    socket = new io(socketUrl, {
        query: "mappingId=" + mappingid,
        secure: true,
        transports: ["websocket"],
    });
    socket.on("connect", () => {
        console.log("Connected to socket.io server");
    });
    setInterval(() => {
        try {
            socket.emit("/v1/alive");
        } catch (e) {
            console.error("Ping error:", e);
        }
    }, 10000);
    socket.on("reconnect_error", () => {
        setTimeout(() => {
            socket.connect();
        }, 1000);
    });
    socket.on('error', (error) => {
        socket.close();
        console.error("Can't connect to socket", error);
    });
    socket.on("connect_error", (error) => {
        socket.close();
        alert("Please check your device internet connection and turn on the stream again. If the problem still persists, please contact our support.");
        console.error("Can't connect to socket:", error);
    });
    socket.on("disconnect", (error) => {
        console.log("Disconnected:", error);
        socket.close();
        setTimeout(() => {
            socket.connect();
        }, 1000);
    });
    socket.on("/v1/ready", (response) => {
        iceServers = response.iceServers;
        console.log("Connection is ready to use", iceServers);
        if (callback) callback();
    });
    socket.on('/v1/stream/start', (response) => {
        stream = response.stream;
    });
    socket.on('/v1/stream/destroy', (response) => {
        //Do something
    });
    socket.on('/v1/stream/joined', (response) => {
        onStreamJoin(response);
    });
    socket.on('/v1/stream/leaved', (response) => {
        console.log('leave');
        viewer = null;
        onStreamLeave(response);
    });
    socket.on('/v1/sdp/peer_ice', (response) => {
        onIncomingICE(response);
    });
    socket.on('/v1/error', (response) => {
        //Do something
    });
}
function onStreamJoin(data) {
    stream = data.stream;
    viewer = true;
    connection.setRemoteDescription(data.sdpAnswer)
        .then(() => {
            answerReceived = true;
            for (let i in inCandidates) {
                if (inCandidates[i].candidate) {
                    const candidate = new RTCIceCandidate(inCandidates[i]);
                    connection.addIceCandidate(candidate);
                }
            }
            for (let i in outCandidates) {
                const data = { stream: stream, message: outCandidates[i] };
                socket.emit('/v1/sdp/ice', data);
            }
        })
        .catch(e => {
            console.log('error on streamJoin', e);
        })
}
function onIncomingICE(response) {
    if (answerReceived) {
        if (response.message.candidate) {
            const candidate = new RTCIceCandidate(response.message);
            connection.addIceCandidate(candidate);
        }
    } else {
        if (!inCandidates) {
            inCandidates = [];
        }
        inCandidates.push(response.message);
    }
    console.log(inCandidates);
}
function onStreamLeave() {
    startStreaming();
}
function startStreaming() {
    this.connect((err) => {
        answerReceived = false;
        if (connection) {
            connection.close();
        }
        inCandidates = [];
        outCandidates = [];
        connection = new RTCPeerConnection({
            iceServers: this.iceServers,
            optional: {
                googCpuOveruseDetection: true,
                googCpuOverUseThreshold: 95,
            },
        });
        mediaStream.getTracks().forEach((track) => {
            connection.addTrack(track, mediaStream);
        });
        connection.onicecandidate = (event) => {
            if (event.candidate) {
                if (answerReceived) {
                    const data = { stream: this.stream, message: event.candidate };
                    socket.emit('/v1/sdp/ice', data);
                } else {
                    outCandidates.push(event.candidate);
                }
            }
        }
        connection
            .createOffer({
                offerToReceiveAudio: 1,
                offerToReceiveVideo: 1,
            })
            .then(
                (desc) => {
                    desc.sdp = desc.sdp.replace(
                        /a=mid:video\r\n/g,
                        "a=mid:video\r\nb=AS:256\r\n"
                    );
                    connection.setLocalDescription(desc);
                    let data = { client: mappingid, stream: this.stream, sdpOffer: desc };
                    socket.emit('/v1/stream/start', data);
                    message = 'waiting';
                },
                (error) => {
                    console.log('Error in Create offer, desc.sdp', error);
                });
        mediaStream.getVideoTracks()[0].addEventListener('ended', () => {
            stopStreaming();
            console.log('stop1');
        });
        mediaStream.oninactive = () => {
            if (viewer == true) {
                console.log('inactive');
                initStreaming();
                startStreaming();
            }
        }
    });
}
function stopStreaming() {
    console.log(connection);
    console.log(mediaStream);
    window.api.getItem('screensharing').then((data) => {
        console.log(data);
    });
    if (connection && viewer === false) {
        connection.close();
        console.log('connection closed');
    }
    if (mediaStream) {
        const tracks = mediaStream.getTracks();
        for (let i in tracks) {
            tracks[i].stop();
        }
        console.log('mediastream closed');
    }
    message = 'done';
    // viewer = null;
    let data = "";
    data = { stream: this.stream };
    //socket.emit('/v1/stream/destroy', data);
}
function initStreaming() {
    socket.close();
    connect();
    window.api.getStream().then((sourceId) => {
        navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: sourceId,
                    minWidth: 1280,
                    maxWidth: 1280,
                    minHeight: 720,
                    maxHeight: 720
                }
            }
        }).then((stream) => {
            console.log('Stream:', stream);
            mediaStream = stream;
        }).catch((error) => {
            console.error('Error getting stream:', error);
        });
    });
}