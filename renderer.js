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
let frameCount = 0;
let startTime = Date.now();
let pc;
let statsInterval = null;

document.addEventListener('DOMContentLoaded', () => {
    connect();

    const startButton = document.getElementById('startButton');
    const stopButton = document.getElementById('stopButton');

    window.api.getItem('screensharing').then((data) => {
        if (data === 'start') {
            startButton.disabled = true;
            initStreaming();
        } else {
            stopButton.disabled = true;
        }
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
                mappingId: "a1f5f7dc-0c08-4396-b0b5-1a49bf234ae6",
                code: "100",
                screenCastingURL:
                    "https://ippcscreenshot2.vantagemdm.com/screen/hmuwti",
                rtmpUrl: undefined,
                deviceId: undefined,
                mdmUrl: undefined,
                deviceName: undefined,
                deviceKey: "8745BC73B35AB04AA787C1553CC9D386",
                productVersion: buildVersion,
                protocol: "wss",
                port: 443,
                host: "streaming.vantagemdm.com",
                streamMode: "live",
                companyUrl: "ippcscreenshot2.vantagemdm.com",
                companyName: "ippcscreenshot2",
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
            initStreaming();
            window.api.setItem('screensharing', "start");
            startButton.disabled = true;
            stopButton.disabled = false;
        });
    }

    if (stopButton) {
        stopButton.addEventListener('click', async () => {
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

function initStreaming() {
    if (socket) {
        socket.close();
    }
    connect();
    mediaStream = new MediaStream();
    window.api.onFrameData((bmpData) => {
        if (bmpData) {
            handleBMPData(bmpData);
        } else {
            console.error('No BMP data received from the C++ application');
        }
    });
}

function updateStats(track) {
    if (pc) {
        pc.getStats(track).then((statsReport) => {
            statsReport.forEach((report) => {
                if (report.type === 'outbound-rtp' && report.kind === 'video') {
                    const customStats = {
                        deliveredFrames: report.framesEncoded || report.framesSent,
                        totalFrames: report.framesSent,
                        frameRate: report.framesPerSecond || (report.framesSent / ((Date.now() - startTime) / 1000)),
                    };
                    track.customStats = customStats;
                }
            });
        });
    }
}

function handleBMPData(bmpData) {
    if (bmpData instanceof Uint8Array) {
        const blob = new Blob([bmpData.buffer], { type: 'image/bmp' });
        const url = URL.createObjectURL(blob);
        const imgElement = new Image();
        imgElement.src = url;
        imgElement.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = imgElement.width;
            canvas.height = imgElement.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(imgElement, 0, 0);
            const stream = canvas.captureStream();
            const videoTrack = stream.getVideoTracks()[0];
            mediaStream = new MediaStream([videoTrack]);

            if (pc) {
                const sender = pc.getSenders().find(s => s.track.kind === videoTrack.kind);
                if (sender) {
                    sender.replaceTrack(videoTrack);
                }
            }

            startStreaming();
        };
        imgElement.onerror = (error) => {
            console.error("Error loading image:", error);
        };
    } else {
        console.error('Expected bmpData to be a Uint8Array, but got:', typeof bmpData, bmpData);
    }
}

function cleanBase64String(base64) {
    return base64.replace(/[^A-Za-z0-9+/=]/g, '');
}

function safeAtob(base64) {
    try {
        return atob(base64);
    } catch (e) {
        console.error('Failed to decode Base64 string:', e);
        return null;
    }
}

function startStreaming() {
    connect((err) => {
        answerReceived = false;
        if (connection) {
            connection.close();
        }
        inCandidates = [];
        outCandidates = [];
        pc = connection = new RTCPeerConnection({
            iceServers: iceServers,
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
                    const data = { stream: stream, message: event.candidate };
                    socket.emit('/v1/sdp/ice', data);
                } else {
                    outCandidates.push(event.candidate);
                }
            }
        };

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
                    let data = { client: mappingid, stream: stream, sdpOffer: desc };
                    socket.emit('/v1/stream/start', data);
                    message = 'waiting';
                },
                (error) => {
                    console.log('Error in Create offer, desc.sdp', error);
                });

        mediaStream.getVideoTracks()[0].addEventListener('ended', () => {
            stopStreaming();
        });

        console.log(mediaStream);

        mediaStream.oninactive = () => {
            if (viewer == true) {
                initStreaming();
            }

            if (statsInterval) {
                clearInterval(statsInterval);
            }

            statsInterval = setInterval(() => {
                if (mediaStream && mediaStream.getVideoTracks().length > 0) {
                    updateStats(mediaStream.getVideoTracks()[0]);
                }
            }, 1000);
        };
    });
}

function stopStreaming() {
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
    }
    if (statsInterval) {
        clearInterval(statsInterval);
    }
    message = 'done';
    let data = "";
    data = { stream: stream };
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
        });
}

function onIncomingICE(response) {
    if (answerReceived) {
        if (response.message.candidate) {
            const candidate = new RTCIceCandidate(response.message);
            connection.addIceCandidate(candidate);
        }
    } else {
        console.log("Not received");
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
