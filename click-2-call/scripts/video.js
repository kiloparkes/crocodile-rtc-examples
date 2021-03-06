// Global variables
var videoSession, transferredSession = null, ringtone;

//Setup Media session configuration
function setVideoSession (mediaSession) {
	
	// The DOM video element used for playing the local party's video
	mediaSession.localVideoElement = $('.receive_localVideo')[0];
	
	// The DOM video element used for playing the remote party's video
	mediaSession.remoteVideoElement = $('.tpl_remotevideo')[0];
	
	/* 
	 * The event handler to fire when a provisional response has been 
	 * received to a new media session request.
	 */
	mediaSession.onProvisional = function () {
		
		// Start the ring tone.
		ringtone.start();
		
		// Set the state element text to 'Ringing'
		$('.ui_status').html('Ringing');
	};
	
	/*
	 * The event handler to fire when a session request has been accepted.
	 */
	mediaSession.onConnect = function () {
		
		// Switch new session to current videoSession
		if (transferredSession) {
			// Copy current session to oldSession
			var oldSession = videoSession;
			// Make the new session usable
			videoSession = transferredSession;
			// Reset transferredSession ready for a new transfer
			transferredSession = null;
			// Close the old session that is no longer used
			oldSession.close();
		}
		
		// Stop the ring tone.
		ringtone.stop();
		
		// Set the status element text to 'Connected'
		$('.ui_status').html('Connected');
	};
	
	/*
	 * The event handler to fire when a call transfer request is received.
	 */
	mediaSession.onTransferRequest = function (event) {
		
		// Accept any incoming call transfer request
		transferredSession = event.accept();
		
		// Set the status element text to 'Transferring...'
		$('.ui_status').html('Transferring...');
		
		// Configure new session
		setVideoSession(transferredSession);
	};
	
	/*
	 * The event handler to fire when a session has been closed by the 
	 * remote party or the network.
	 */
	mediaSession.onClose = function () {
		
		// Check its the current session, don't setup if it isn't
		if(videoSession !== mediaSession) {
			return;
		} 
		
		// Reset transferredSession ready for another transfer if/when its requested
		if(mediaSession === transferredSession){

			// Set the status element text to 'Transfer failed'
			$('.ui_status').html('Transfer failed');
			transferredSession = null;
			return;
		}
		
		// Make sure ringtone has stopped
		if (ringtone) {
			ringtone.stop();
		}
		
		// Stop duration of call
		clearInterval(setCallDuration);
		
		// Set the status element text to 'Disconnected'
		$('.ui_status').html('Disconnected');
		
		// Hide the warning light to indicate there are no calls
		$('.warning-light').hide();
		
		// Reset mute button
		$('.btn_mute_s').removeClass('selected');
		
		// Reset video pause button
		$('.btn_pausevideo_s').removeClass('selected');
		$('.tpl_controls').removeClass('ui_localvideodisabled');
		
		// Reset pop-out
		$('.ui_popout').removeClass('ui_popout_open');
		$('.tpl_titlebar').removeClass('ui_shown');
		$('.tpl_actions').removeClass('ui_shown');
		
		// Close down connection to network
		crocObject.disconnect();
	};
}

// End the call by closing media session
function endVideo() {
	videoSession.close();
}

// Mute the audio
function muteAudio() {
	
	// Disable the sessions audio track
	videoSession.mute();
	
	// Turn icon green to show its been pressed
	$('.btn_mute_s').addClass('selected');
}

// Un-mute the audio
function unmuteAudio() {
	
	// Un-mute the sessions audio track
	videoSession.unmute();
	
	// Restore icon back to white
	$('.btn_mute_s').removeClass('selected');
}

// Pause the remote video
function pauseVideo() {
	
	// Disable the sessions video track
	videoSession.localStream.getVideoTracks()[0].enabled=false;
	
	// Turn icon green to show its been pressed
	$('.btn_pausevideo_s').addClass('selected');
	
	// Add disabled icon to local video
	$('.tpl_controls').addClass('ui_localvideodisabled');
}

// Un-Pause the remote video
function resumeVideo() {
	
	// Un-mute the sessions video track
	videoSession.localStream.getVideoTracks()[0].enabled=true;
	
	// Restore icon back to white
	$('.btn_pausevideo_s').removeClass('selected');
	
	// Remove disabled icon on local video
	$('.tpl_controls').removeClass('ui_localvideodisabled');
}

// Determine whether to go full screen or not
function setVideoToFullscreen(enabled) {
	var initial = true;
	var uiElement = $('.widget_videocall')[0]; // jQuery element to make full screen

	// Listen for fullscreen change, ignore initial change
	uiElement.onmozfullscreenchange = uiElement.onwebkitfullscreenchange = function(){
		if(isFullscreen && !initial) {
			setVideoToFullscreen(false);
		}

		initial = false;
	};

	if(enabled && !$('.widget_videocall').hasClass('ui_fullscreen')){
		// Set fullscreen
		isFullscreen = true;
		$('.widget_videocall').addClass('ui_fullscreen');
		if(uiElement.webkitRequestFullscreen) {
			uiElement.webkitRequestFullscreen();
		} else if(uiElement.mozRequestFullscreen) {
			uiElement.mozRequestFullscreen();
		}
	} else {
		// Exit fullscreen
		isFullscreen = false;
		$('.widget_videocall').removeClass('ui_fullscreen');
		if(document.webkitExitFullscreen) {
			document.webkitExitFullscreen();
		} else if(document.mozExitFullscreen) {
			document.mozExitFullscreen();
		}
	}
}

// Video session set-up
function requestVideo(crocApiKey, addressToCall, crocDisplayName) {
	
	// CrocSDK API Configuration
	var crocConfig = {
		// The API Key registered to the Crocodile RTC SDK Network
		apiKey: crocApiKey,
		
		// The text to display to call recipient
		displayName: crocDisplayName,
		
		// The features that the application will implement
		features: ['audio', 'video', 'transfer'],
		
		// The event handler to fire when connected to the network
		onConnected: function() {
			
			// Connection has been established; don't connect on click
			crocObjectConnected = true;
			
			// Get the address of the user to call
			var address = addressToCall;
			
			// Set up stream to be able to send and receive video and audio
			var callConfig = {
					audio: {
						send: true, receive: true
					}, 
					video: {
						send: true, receive: true
					}
			};
			
			// Show the warning light to indicate a call is live
			$('.warning-light').show();
			
			// Set remote party's address
			/*$('.ui_uri').html(address);*/
			
			// Set the status element text to 'Connecting'
			$('.ui_status').html('Connecting');
			
			// Set the duration element to start timing the duration of the call
			var callStartDate = new Date().getTime();
			setDuration(callStartDate);
			
			// Set up ring tone frequency
			var ringtone_frequency = localisations[ringtoneToUse].ringbacktone.freq;
			
			// Set up ring tone timing
			var ringtone_timing = localisations[ringtoneToUse].ringbacktone.timing;
			
			// Create an instance of the ring tone object
			ringtone = new audio.Ringtone(ringtone_frequency, ringtone_timing);
			
			// media.connect requests a media session and returns the session object
			videoSession = crocObject.media.connect(address, {
				streamConfig: callConfig
			});
			
			// Configure new session
			setVideoSession(videoSession);
		},
		
		/*
		 * The event handler to fire when a user been has disconnected from 
		 * the network.
		 */
		onDisconnected: function () {
			
			// Make sure ringtone has stopped
			if (ringtone) {
				ringtone.stop();
			}
			
			// Allow calls to be made on click
			crocObjectConnected = false;
			
			// Make sure duration of call has stopped
			clearInterval(setCallDuration);
			
			// Trigger click to collapse the tab.
			isClicked = true;
			$('.side-tab').trigger('click');
		}
	};

	// Instantiation of croc object with basic configuration
	crocObject = $.croc(crocConfig);
}