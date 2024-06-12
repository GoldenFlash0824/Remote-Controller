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

module.exports = {
    initStreaming
};
