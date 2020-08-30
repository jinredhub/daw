$(document).ready(function () {

    const globalMusicTracks = {
        total_duration: 0,
        trackEndSliderPosition: 0,
        tracks: [],
    };
    const globalWaveformHeight = 100;
    const globalWaveformHeightPaddingTop = 65;
    const globalSpaceForBottom = 100;
    const globalSpaceForTop = 30;
    let globalCurrentZoomLevel = 1;
    let myInterval = null;
    let globalMusicTrackX = [];
    let globalIsPlaying = false;
    const globalLineColor = ['ffc5c5', 'ffe5c5', 'f2ed31', '7ce0f0', '7c80f0', 'feb2ff', 'c3c3c3'];
    let colorIndex = 0;
    let globalDeleteTrackId = null;

    let setScrollInterval = null;

    const audioFiles = [];


    $('#openCombineTracksModal').on('click', function () {
        $('#combineTrackModal').css('display', 'flex');
    });


    $('.closeCombineTrackModal').on('click', function () {
        $('#combineTrackModal').css('display', 'none');
    });


    $('.confirmCombineTrackButton').on('click', function () {
        if (audioFiles.length >= 1) {
            // close 
            $('#combineTrackModal').css('display', 'none');

            // show
            $('#resultModal').css('display', 'flex');
            $('#processingIcon').css('display', 'block');

            // hide download link
            $('#downloadFinalTrack').css('display', 'none');
            $('.closeResultModal').css('display', 'none');

            getTrackInfo();

            handleFilesSelect(audioFiles);
        }
        else {
            alert('There are no tracks to combine.');
        }
    });


    $('.closeResultModal').on('click', function () {
        $('#resultModal').css('display', 'none');
    });


    $('#questionButton').on('click', function () {
        $('#questionModal').css('display', 'flex');
    });

    $('.closeQuestionModalButton').on('click', function () {
        $('#questionModal').css('display', 'none');
    });



    // close modal when click outside
    const questionModal = document.querySelector('#questionModal');
    const bpmModal = document.querySelector('#bpmModal');

    window.onclick = function (event) {
        if (event.target == questionModal) {
            questionModal.style.display = 'none';
        }
    }


    // this is for x-axis for duration
    function renderTimeScale() {
        // default: maxDurationMin = 10 mins,
        // ticks = maxDurationMin * 10
        // containerWidth = maxDurationMin * 2800
        // wave container size : see other function,

        // change ticks count--------
        let tickMultiplier = 0;
        if (globalCurrentZoomLevel >= 0.25 && globalCurrentZoomLevel <= 2) {
            tickMultiplier = 50;
        }
        else if (globalCurrentZoomLevel >= 4) {
            tickMultiplier = 200;
        }
        else if (globalCurrentZoomLevel <= 0.125) {
            tickMultiplier = 10;
        }
        // --------------------------------------------------

        const maxDurationMin = 10;
        const maxDurationSec = maxDurationMin * 60;

        d3.select('#displayScale').select('svg').remove();

        // update container width
        const newWidth = maxDurationMin * 2800 * globalCurrentZoomLevel;
        $('#mixingScrollDiv').width(newWidth);
        const svg = d3.select('#displayScale')
            .append('svg')
            .attr('width', newWidth)
            .attr('height', 30);

        const xScale = d3.scaleLinear()
            .domain([0, maxDurationSec])
            .range([0, newWidth - 20]);

        svg.append('g')
            .attr('class', 'scaleGroup')
            .attr('transform', 'translate(0, ' + 28 + ')') // move 0px from left origin
            .call(d3.axisTop(xScale).tickFormat(function (d) {
                const duration = moment.duration(d, 'seconds');

                // format 00:00
                let minutes = '';
                let seconds = '';

                if (duration.minutes() < 10) {
                    minutes = '0' + duration.minutes();
                }
                else {
                    minutes = duration.minutes();
                }
                if (duration.seconds() < 10) {
                    seconds = '0' + duration.seconds();
                }
                else {
                    seconds = duration.seconds();
                }

                // update which ticks to display duration
                if (globalCurrentZoomLevel >= 0.25 && globalCurrentZoomLevel <= 2) {
                    if (d % 5 === 0) {
                        if (minutes === '00' && seconds === '00') {
                            return '';
                        }
                        else {
                            return minutes + ':' + seconds;
                        }
                    }
                }
                else if (globalCurrentZoomLevel >= 4) {
                    // return duration to all ticks
                    if (d % 1 === 0) {
                        if (minutes === '00' && seconds === '00') {
                            return '';
                        }
                        else {
                            return minutes + ':' + seconds;
                        }
                    }
                }
                else if (globalCurrentZoomLevel <= 0.125) {
                    if (d % 2 === 0) {
                        if (minutes === '00' && seconds === '00') {
                            return '';
                        }
                        else {
                            return minutes + ':' + seconds;
                        }
                    }
                }

            }).ticks(maxDurationMin * tickMultiplier));


        // update height
        const lines = $('.scaleGroup').find('line');
        if (globalCurrentZoomLevel >= 0.25 && globalCurrentZoomLevel <= 1) {
            for (let i = 0; i < lines.length; i++) {
                if (i % 5 === 0) {
                    $(lines[i]).css('transform', `scale(1, 1.5)`);
                }
                else {
                    $(lines[i]).css('transform', `scale(1, 1)`);
                }
            }
        }
        else if (globalCurrentZoomLevel >= 2) {
            for (let i = 0; i < lines.length; i++) {
                if (i % 5 === 0) {
                    $(lines[i]).css('transform', `scale(1, 1.5)`);
                }
                else {
                    $(lines[i]).css('transform', `scale(1, 1)`);
                }
            }
        }
        else if (globalCurrentZoomLevel <= 0.125) {
            for (let i = 0; i < lines.length; i++) {
                if (i % 2 === 0) {
                    $(lines[i]).css('transform', `scale(1, 1.5)`);
                }
                else {
                    $(lines[i]).css('transform', `scale(1, 1)`);
                }
            }
        }

    }



    // make the el draggable====================================
    $('#mixingContainer').on('mousedown touchstart', '.waveform, #trackEndSlider, .trackLeftTrimSlider, .trackRightTrimSlider, #animateThisBarHandle, .lockIconAboveWaveform', function (e) {
        e.stopPropagation();
        e.preventDefault();

        // prevent drag then use click event for lock button for mobile
        if ($(this).hasClass('lockIconAboveWaveform')) {
            if (e.type === 'touchstart') {
                $(this).trigger('click');
            }
            return;
        }

        // check if waveform is locked
        const dataDrag = $(this).closest('.waveform').attr('data-drag');
        if (dataDrag === 'false') {
            return;
        }

        let currentX = 0;
        let initialX = 0;

        const that = this;

        // get the mouse cursor position at startup
        if (e.type === 'touchstart') {
            // for mobile devices
            $('#mixingContainer').css('overflow-x', 'hidden');

            initialX = e.touches[0].clientX;
        }
        else {
            initialX = e.clientX;
        }

        // add will-change css
        $(that).css('will-change', 'left');
        if ($(that).hasClass('trackLeftTrimSlider')) {
            const trackId = $(that).closest('.waveform').attr('data-trackid');
            $(`#verticalTrackBeginLine${trackId}`).css('will-change', 'left');
        }
        else if ($(that).hasClass('trackRightTrimSlider')) {
            const trackId = $(that).closest('.waveform').attr('data-trackid');
            $(`#verticalTrackEndLine${trackId}`).css('will-change', 'left');
        }

        $(document).on('mouseup touchend', function (e) {
            // for mobile devices
            $('#mixingContainer').css('overflow-x', 'auto');

            // stop moving when mouse button is released
            $(document).off('mouseup touchend');
            $(document).off('mousemove touchmove');

            // for moving tracks
            const targetId = that.id;
            if (targetId !== 'trackEndSlider' && $(that).hasClass('trackLeftTrimSlider') === false && $(that).hasClass('trackRightTrimSlider') === false) {
                moveBackTrackEndSliderWhenMovingTrack(that);
            }

            // remove will-change css
            $(that).css('will-change', '');
            if ($(that).hasClass('trackLeftTrimSlider')) {
                const trackId = $(that).closest('.waveform').attr('data-trackid');
                $(`#verticalTrackBeginLine${trackId}`).css('will-change', '');
            }
            else if ($(that).hasClass('trackRightTrimSlider')) {
                const trackId = $(that).closest('.waveform').attr('data-trackid');
                $(`#verticalTrackEndLine${trackId}`).css('will-change', '');
            }

            checkPreventMovingTrackLessThanZero();
            // checkPreventMovingOverOtherTrimSlider(that);
            updateLeftTrimSliderZIndex(that);
        });

        // call a function whenever the cursor moves==================================
        $(document).on('mousemove touchmove', function (e) {
            e.preventDefault();

            const trackId = $(that).closest('.waveform').attr('data-trackId');

            const targetId = that.id;

            // calculate new cursor position
            // calculating diffrence between old mouse position and new mouse position
            if (e.type === 'touchmove') {
                currentX = initialX - e.touches[0].clientX;
                initialX = e.touches[0].clientX;
            }
            else {
                currentX = initialX - e.clientX;
                initialX = e.clientX;
            }

            // prevent moving el less than 0
            if (that.offsetLeft < 0) {
                that.offsetLeft = 0;

                //
                if (targetId === 'trackEndSlider') {
                    that.offsetLeft = 20;
                    that.style.left = 20 + 'px';
                }
                else if (targetId === 'animateThisBarHandle') {
                    $('#animateThisBarHandle').css('left', 0);
                    $('#animateThisBar').css('left', 0);
                }
                else {
                    // reset verticalTrackBeginLine and verticalTrackEndLine
                    const resetLeft = parseFloat($(`#trackLeftTrimSlider${trackId}`).css('left').split('px')[0]);
                    const resetRight = parseFloat($(`#trackRightTrimSlider${trackId}`).css('left').split('px')[0]);

                    $(`#verticalTrackBeginLine${trackId}`).css('left', resetLeft + 'px');
                    $(`#verticalTrackEndLine${trackId}`).css('left', resetRight + 'px');
                }
            }
            else {
                that.style.left = (that.offsetLeft - currentX) + 'px';

                // move verticalTrackBeginLine and verticalTrackEndLine while dragging a track
                if ($(that).hasClass('waveform')) {
                    const verticalTrackBeginLineEl = document.getElementById(`verticalTrackBeginLine${trackId}`);
                    const verticalTrackEndLineEl = document.getElementById(`verticalTrackEndLine${trackId}`);
                    verticalTrackBeginLineEl.style.left = (verticalTrackBeginLineEl.offsetLeft - currentX) + 'px';
                    verticalTrackEndLineEl.style.left = (verticalTrackEndLineEl.offsetLeft - currentX) + 'px';
                }
            }

            if (targetId === 'trackEndSlider') {
                // scale the slider
                const trackEndSliderLeft = that.style.left.split('px')[0];

                $('#activeTrackDiv').width(parseFloat(trackEndSliderLeft) + 4);
            }
            else if (targetId === 'animateThisBarHandle') {
                // move animateThisBar as well
                document.getElementById('animateThisBar').style.left = (that.offsetLeft - currentX) + 'px';
            }


            // moving the trackRightTrimSlider and trackLeftTrimSlider
            const isLeftSlider = $(that).hasClass('trackLeftTrimSlider');
            const isRightSlider = $(that).hasClass('trackRightTrimSlider');


            if (isLeftSlider) {
                let leftValue = parseFloat($(that).css('left').split('px')[0]);

                $(`#leftTrim${trackId}`).width(leftValue);

                // move verticalTrackBeginLine
                const waveformContainerLeft = parseFloat($(`#waveform${trackId}`).css('left').split('px')[0]);
                $(`#verticalTrackBeginLine${trackId}`).css('left', waveformContainerLeft + leftValue + 'px');

                // prevent moving over right slider
                const rightValue = parseFloat($(that).closest('.waveform').find('.trackRightTrimSlider').css('left').split('px')[0]);
                if (leftValue > rightValue) {
                    leftValue = rightValue;
                    $(that).css('left', rightValue + 'px');
                    $(`#leftTrim${trackId}`).width(rightValue);

                    // reset verticalTrackBeginLine
                    $(`#verticalTrackBeginLine${trackId}`).css('left', waveformContainerLeft + rightValue + 'px');
                }

                // prevent moving slider less thatn 0
                if (leftValue < 0) {
                    leftValue = 0;
                    $(that).css('left', 0);

                    // reset verticalTrackBeginLine
                    $(`#verticalTrackBeginLine${trackId}`).css('left', waveformContainerLeft + 'px');
                }

            }
            else if (isRightSlider) {
                const containerWidth = $(that).closest('.waveform').width();
                let rightValue = parseFloat($(that).css('left').split('px')[0]);

                $(`#rightTrim${trackId}`).width(containerWidth - rightValue);

                // prevent moving over left slider
                const leftValue = parseFloat($(that).closest('.waveform').find('.trackLeftTrimSlider').css('left').split('px')[0]);
                if (leftValue > rightValue) {
                    rightValue = leftValue;
                    $(that).css('left', leftValue + 'px');
                    $(`#rightTrim${trackId}`).width(containerWidth - leftValue);
                }

                // move verticalTrackEndLine
                const waveformContainerLeft = parseFloat($(`#waveform${trackId}`).css('left').split('px')[0]);
                $(`#verticalTrackEndLine${trackId}`).css('left', waveformContainerLeft + rightValue + 'px');

                // prevent moving slider over 100% of container
                if (rightValue > containerWidth) {
                    rightValue = containerWidth;
                    $(that).css('left', containerWidth + 'px');

                    // reset verticalTrackEndLine
                    $(`#verticalTrackEndLine${trackId}`).css('left', waveformContainerLeft + rightValue + 'px');
                }

            }
        });
    });
    // end make the el draggable====================================



    function loadNewAudioTrack(audioFile, fileName, isNewTrack) {
        // default: waveform width = duration * 46.633

        // enable buttons
        if (globalCurrentZoomLevel !== 0.125) {
            $('.zoomOut').css('opacity', 1).prop('disabled', false);
        }
        if (globalCurrentZoomLevel !== 4) {
            $('.zoomIn').css('opacity', 1).prop('disabled', false);
        }
        $('#playWaveFormButton').css('opacity', 1).prop('disabled', false);
        $('#openCombineTracksModal').css('opacity', 1).prop('disabled', false);

        // hide empty track message
        $('#trackIsEmptyDiv').css('display', 'none');

        // clear setScrollInterval
        if (setScrollInterval) {
            clearInterval(setScrollInterval);
        }

        // check if saved track or new one
        if (isNewTrack === 'true') {

            // only to load duration
            const useThisforDurationWs = WaveSurfer.create({
                container: '#temp',
                scrollParent: false,
                interact: false,
                pixelRatio: 1,  // 1 for faster rendering
            });

            useThisforDurationWs.on('ready', function () {
                const newId = guid();
                const duration = useThisforDurationWs.getDuration();

                // append new div
                $('#mixingScrollDiv').append(`
                    <div id='waveform${newId}' class='waveform' data-trackId='${newId}' data-drag='true'></div>
                `);

                // resize container first
                const newWaveformWidth = duration * 46.633;
                $('#waveform' + newId).css('width', newWaveformWidth * globalCurrentZoomLevel + 'px');

                const data = {
                    ws: '',
                    id: newId,
                    duration: duration,
                    title: fileName,
                    description: '',
                    mute: false,
                    volume: 0.5,
                    lock: false,
                }

                // append detail to trackDetailPanel
                appendTrackDetail(newId, data.title, '');

                data.ws = WaveSurfer.create({
                    container: '#waveform' + newId,
                    waveColor: '#949494',
                    progressColor: '#444',
                    backgroundColor: '#fafafa',
                    scrollParent: false,
                    height: globalWaveformHeight,
                    interact: false,
                    pixelRatio: 2,  // 1 for faster rendering
                    minPxPerSec: 46.6 * globalCurrentZoomLevel,
                });

                data.ws.on('ready', function () {

                    globalMusicTracks.tracks.push(data);

                    // set volume to 0.5
                    data.ws.setVolume(data.volume);

                    // show showHideTrackDetailPanelButton
                    $('#showHideTrackDetailPanelButton').css('display', 'flex');

                    renderTimeScale();
                    updateWaveformYaxis();
                    updateMixingContainerHeight();
                    updateAnimateThisBarHeight();

                    // update the slider only for the first time
                    if (globalMusicTracks.tracks.length === 1) {
                        moveTrackEndSlider(newId);
                    }

                    setScrollInterval = setInterval(scrollMixingContainer, 32);

                    // get color
                    if (colorIndex === globalLineColor.length) {
                        colorIndex = 0;
                    }

                    const color = globalLineColor[colorIndex];

                    // append trim slider
                    appendTrimSliderAndLock(newId, data.title);

                    // append verticalTrackBeginLine and verticalTrackEndLine
                    appendVericalTrackBeginEndLines(newId, newWaveformWidth, color, 'new');

                    // update height of detail panel
                    updateDetailPanelHeight();

                    updateHeightOfVerticalTrackLine();

                    colorIndex++;

                    // loading icon------------------------------------
                    $('#loading').css('display', 'none');

                });

                data.ws.load(audioFile);

            });

            useThisforDurationWs.load(audioFile);
        }
        else {
            for (let i = 0; i < globalMusicTracks.tracks.length; i++) {
                const newId = globalMusicTracks.tracks[i].id;
                const duration = globalMusicTracks.tracks[i].duration;

                // append new div
                $('#mixingScrollDiv').append(`
                    <div id='waveform${newId}' class='waveform' data-trackId='${newId}' data-drag='true'></div>
                `);

                // resize container first
                const newWaveformWidth = duration * 46.633;
                $('#waveform' + newId).css('width', newWaveformWidth * globalCurrentZoomLevel + 'px');

                // append detail to trackDetailPanel
                appendTrackDetail(newId, globalMusicTracks.tracks[i].title, globalMusicTracks.tracks[i].description);

                globalMusicTracks.tracks[i].ws = WaveSurfer.create({
                    container: '#waveform' + newId,
                    waveColor: '#949494',
                    progressColor: '#444',
                    backgroundColor: '#fafafa',
                    fillParent: true,
                    scrollParent: false,
                    height: globalWaveformHeight,
                    interact: false,
                    pixelRatio: 2,  // 1 for faster rendering
                    minPxPerSec: 46.6 * globalCurrentZoomLevel,
                });

                globalMusicTracks.tracks[i].ws.on('ready', function () {

                    // set volume
                    globalMusicTracks.tracks[i].ws.setVolume(globalMusicTracks.tracks[i].volume);

                    // show showHideTrackDetailPanelButton
                    $('#showHideTrackDetailPanelButton').css('display', 'flex');

                    renderTimeScale();
                    updateWaveformYaxis();
                    updateMixingContainerHeight();
                    updateAnimateThisBarHeight();

                    // update the slider only for the first time
                    if (globalMusicTracks.tracks.length === 1) {
                        moveTrackEndSlider(newId);
                    }

                    setScrollInterval = setInterval(scrollMixingContainer, 40);

                    // get color
                    if (colorIndex === globalLineColor.length) {
                        colorIndex = 0;
                    }

                    const color = globalLineColor[colorIndex];

                    // append trim slider
                    appendTrimSliderAndLock(newId, globalMusicTracks.tracks[i].title);

                    // append verticalTrackBeginLine and verticalTrackEndLine
                    appendVericalTrackBeginEndLines(newId, newWaveformWidth, color, 'new');

                    // update height of detail panel
                    updateDetailPanelHeight();

                    updateHeightOfVerticalTrackLine();

                    colorIndex++;

                    updateUIfromSavedData(globalMusicTracks.tracks[i]);

                    updateTrackEndSliderFromSavedData(globalMusicTracks.trackEndSliderPosition);

                    // ready event fires when waveform drwan but it takes few more secs.
                    // provide 2 sec before loading animation disappear.
                    setTimeout(function(){
                        // loading icon------------------------------------
                        $('#loading').css('display', 'none');
                    }, 2000);

                });

                globalMusicTracks.tracks[i].ws.load(globalMusicTracks.tracks[i].audioFileUrl);
            }
        }
    }



    $('#addNewAudioFile').on('change', function (e) {
        let fileName = '';
        if (this.files && this.files.length > 1) {
            fileName = (this.getAttribute('data-multiple-caption') || '').replace('{count}', this.files.length);
        }
        else {
            fileName = e.target.value.split('\\').pop();
        }

        if (fileName) {
            // file extension and size vertification
            const fileNameSplit = e.target.files[0].name.split('.');
            let fileExtension = fileNameSplit[fileNameSplit.length - 1];
            fileExtension = fileExtension.toLowerCase();
            const fileSize = e.target.files[0].size / 1024 / 1024;

            // let isAcceptableExtension = null;
            if (fileExtension === "mp3" || fileExtension === "m4a" || fileExtension === "wav" || fileExtension === "ogg") {
                // isAcceptableExtension = true;
            }
            else {
                // if wong extansion
                alert('Please upload supported audio extensions: mp3, m4a, wav, ogg');

                return;
            }

            // loading icon------------------------------------
            $('#loading').css('display', 'flex');

            const userFile = e.target.files[0];

            audioFiles.push({
                'audioFile': userFile,
                'isInputFile': true,
            });

            var reader = new FileReader();
            reader.readAsDataURL(userFile);
            reader.onload = function (evt) {

                loadNewAudioTrack(reader.result, fileName, 'true');

            }
        }
    });



    $('#playWaveFormButton').on('click', function () {
        // hide click here message
        $('#clickToPlayTooltip').css('display', 'none');

        globalIsPlaying = d3.select('#animateThisBar').attr('data-isPlaying');

        if (globalIsPlaying === 'true') {
            // enable delete button
            $('.deleteTrackButton').css('opacity', 1).prop('disabled', false);

            // enable editing tracks
            document.getElementById('mixingContainer').style.pointerEvents = 'auto';

            $(this).html('<i class="fas fa-play" style="font-size:14px"></i>');

            d3.select('#animateThisBar').attr('data-isPlaying', false)
                .transition()
                .duration(0);

            d3.select('#animateThisBarHandle').attr('data-isPlaying', false)
                .transition()
                .duration(0);

            clearInterval(myInterval);

            // pause all tracks
            for (let i = 0; i < globalMusicTracks.tracks.length; i++) {
                if (globalMusicTracks.tracks[i].ws.isPlaying()) {
                    globalMusicTracks.tracks[i].ws.stop();
                }
            }

            globalIsPlaying = false;

        }
        else {
            // disable delete button
            $('.deleteTrackButton').css('opacity', 0.4).prop('disabled', true);

            // disable editing tracks during play
            document.getElementById('mixingContainer').style.pointerEvents = 'none';

            $(this).html('<i class="fas fa-pause" style="font-size:14px"></i>');

            const animateLineLeft = parseFloat($('#animateThisBar').css('left').split('px')[0]);
            const animateLineDuration = 600000; // 10 mins
            const containerWidth = $('#mixingScrollDiv').width();
            const containerHeight = document.getElementById('mixingContainer').clientHeight - 1;

            const trackEndSliderLeft = parseFloat($('#trackEndSlider').css('left').split('px')[0]);
            let newAnimateLineDuration = null;

            if (animateLineLeft >= trackEndSliderLeft) {
                // play from beginning
                newAnimateLineDuration = 0;
            }
            else {
                // play from animateThisBar position
                const newAnimateLineDurationPercentage = animateLineLeft / containerWidth;

                newAnimateLineDuration = animateLineDuration * newAnimateLineDurationPercentage;
            }

            const line = d3.select('#animateThisBar')
                .style('height', containerHeight + 'px')
                .style('left', newAnimateLineDuration)
                .attr('data-isPlaying', true);

            const lineHandle = d3.select('#animateThisBarHandle')
                .style('left', newAnimateLineDuration);

            line.transition()
                .duration(animateLineDuration)
                .ease(d3.easeLinear)
                .style('left', containerWidth + 'px')
                .style('height', containerHeight + 'px');

            lineHandle.transition()
                .duration(animateLineDuration)
                .ease(d3.easeLinear)
                .style('left', containerWidth + 'px');

            getTrackInfo();

            // execute func once before setInterval
            compareAllTrackXThenPlayStop();

            // 1000 = 1 sec
            let intervalNum = 10;
            if (globalCurrentZoomLevel === 4) {
                intervalNum = 1;
            }
            myInterval = setInterval(compareAllTrackXThenPlayStop, intervalNum);

        }

    });



    function compareAllTrackXThenPlayStop() {
        const animateThisBarX = parseFloat($('#animateThisBar').css('left').split('px')[0]);

        // play
        for (let i = 0; i < globalMusicTrackX.length; i++) {
            if (globalMusicTrackX[i].startPlayPixel <= animateThisBarX && globalMusicTrackX[i].playStarted === false && globalMusicTrackX[i].endPlayPixel >= animateThisBarX) {
                if (globalMusicTrackX[i].startPlayPixel <= animateThisBarX) {
                    // re-calculate start sec
                    const leftTrimPercentage = (animateThisBarX - globalMusicTrackX[i].left) / globalMusicTrackX[i].containerWidth;
                    const newStartPlaySec = globalMusicTracks.tracks[i].duration * leftTrimPercentage;

                    globalMusicTrackX[i].playStarted = true;

                    globalMusicTracks.tracks[i].ws.play(newStartPlaySec, globalMusicTrackX[i].track_end);
                }
                else {
                    globalMusicTrackX[i].playStarted = true;

                    globalMusicTracks.tracks[i].ws.play(globalMusicTrackX[i].track_start, globalMusicTrackX[i].track_end);
                }
            }
        }

        // check trackEndSlider
        const trackEndSliderPosition = $('#trackEndSlider').css('left').split('px')[0];
        if (animateThisBarX >= trackEndSliderPosition) {
            $('#playWaveFormButton').trigger('click');
        }
    }



    function updateWaveformYaxis() {
        for (let i = 0; i < globalMusicTracks.tracks.length; i++) {
            $(`#waveform${globalMusicTracks.tracks[i].id}`).css('top', globalWaveformHeight * i + globalWaveformHeightPaddingTop * (i + 1) + globalSpaceForTop);
        }
    }



    function updateMixingContainerHeight() {
        $('#mixingContainer').css('height', (globalWaveformHeight + globalWaveformHeightPaddingTop) * globalMusicTracks.tracks.length + globalSpaceForTop + globalSpaceForBottom);
    }


    function updateAnimateThisBarHeight() {
        const containerHeight = document.getElementById('mixingContainer').clientHeight - 1;

        const line = d3.select('#animateThisBar')
            .style('height', containerHeight + 'px');
    }



    $('.zoomIn').on('click', function (e) {
        // Need 200ms to  display #loading
        // loading icon------------------------------------
        $('#loading').css('display', 'flex');

        setTimeout(function () {
            globalCurrentZoomLevel *= 2;

            // values before update
            const activeTrackDivWidth = Number($('#activeTrackDiv').css('width').split('px')[0]);

            const animateThisBarLeft = Number($('#animateThisBar').css('left').split('px')[0]);

            renderTimeScale();

            // update activeTrack
            $('#activeTrackDiv').css('width', activeTrackDivWidth * 2 + 'px');
            $('#trackEndSlider').css('left', activeTrackDivWidth * 2 + 'px');

            // update animateThisBar
            $('#animateThisBar').css('left', animateThisBarLeft * 2 + 'px');
            $('#animateThisBarHandle').css('left', animateThisBarLeft * 2 + 'px');

            for (let i = 0; i < globalMusicTracks.tracks.length; i++) {
                // values before update
                const waveformWidth = Number($(`#waveform${globalMusicTracks.tracks[i].id}`).css('width').split('px')[0]);
                const waveformLeft = Number($(`#waveform${globalMusicTracks.tracks[i].id}`).css('left').split('px')[0]);

                const verticalTrackBeginLineLeft = Number($(`#verticalTrackBeginLine${globalMusicTracks.tracks[i].id}`).css('left').split('px')[0]);
                const verticalTrackEndLineLeft = Number($(`#verticalTrackEndLine${globalMusicTracks.tracks[i].id}`).css('left').split('px')[0]);

                const trackLeftTrimSliderLeft = Number($(`#trackLeftTrimSlider${globalMusicTracks.tracks[i].id}`).css('left').split('px')[0]);
                const trackRightTrimSliderLeft = Number($(`#trackRightTrimSlider${globalMusicTracks.tracks[i].id}`).css('left').split('px')[0]);

                // update waveform
                $(`#waveform${globalMusicTracks.tracks[i].id}`).css(
                    {
                        'width': waveformWidth * 2 + 'px',
                        'left': waveformLeft * 2 + 'px',
                    }
                );

                globalMusicTracks.tracks[i].ws.zoom(46.6 * globalCurrentZoomLevel);

                // update vertical lines
                $(`#verticalTrackBeginLine${globalMusicTracks.tracks[i].id}`).css('left', verticalTrackBeginLineLeft * 2 + 'px');
                $(`#verticalTrackEndLine${globalMusicTracks.tracks[i].id}`).css('left', verticalTrackEndLineLeft * 2 + 'px');

                // update trim slider
                $(`#trackLeftTrimSlider${globalMusicTracks.tracks[i].id}`).css('left', trackLeftTrimSliderLeft * 2 + 'px');
                $(`#trackRightTrimSlider${globalMusicTracks.tracks[i].id}`).css('left', trackRightTrimSliderLeft * 2 + 'px');

                $(`#leftTrim${globalMusicTracks.tracks[i].id}`).css('width', trackLeftTrimSliderLeft * 2 + 'px');
                $(`#rightTrim${globalMusicTracks.tracks[i].id}`).css('width', (waveformWidth - trackRightTrimSliderLeft) * 2 + 'px');
            }

            if (globalCurrentZoomLevel === 4) {
                $('.zoomIn').css('opacity', 0.5).prop('disabled', true);
                $('.zoomOut').css('opacity', 1).prop('disabled', false);
            }
            else {
                $('.zoomIn').css('opacity', 1).prop('disabled', false);
                $('.zoomOut').css('opacity', 1).prop('disabled', false);
            }

            // loading icon------------------------------------
            $('#loading').css('display', 'none');
        }, 200);

    });

    $('.zoomOut').on('click', function () {

        // loading icon------------------------------------
        $('#loading').css('display', 'flex');

        // Need 200ms to  display #loading
        setTimeout(function () {

            globalCurrentZoomLevel /= 2;

            // values before update
            const activeTrackDivWidth = Number($('#activeTrackDiv').css('width').split('px')[0]);

            const animateThisBarLeft = Number($('#animateThisBar').css('left').split('px')[0]);

            renderTimeScale();

            // update activeTrack
            $('#activeTrackDiv').css('width', activeTrackDivWidth * 0.5 + 'px');
            $('#trackEndSlider').css('left', activeTrackDivWidth * 0.5 + 'px');

            // update animateThisBar
            $('#animateThisBar').css('left', animateThisBarLeft * 0.5 + 'px');
            $('#animateThisBarHandle').css('left', animateThisBarLeft * 0.5 + 'px');

            for (let i = 0; i < globalMusicTracks.tracks.length; i++) {
                // values before update
                const waveformWidth = Number($(`#waveform${globalMusicTracks.tracks[i].id}`).css('width').split('px')[0]);
                const waveformLeft = Number($(`#waveform${globalMusicTracks.tracks[i].id}`).css('left').split('px')[0]);

                const verticalTrackBeginLineLeft = Number($(`#verticalTrackBeginLine${globalMusicTracks.tracks[i].id}`).css('left').split('px')[0]);
                const verticalTrackEndLineLeft = Number($(`#verticalTrackEndLine${globalMusicTracks.tracks[i].id}`).css('left').split('px')[0]);

                const trackLeftTrimSliderLeft = Number($(`#trackLeftTrimSlider${globalMusicTracks.tracks[i].id}`).css('left').split('px')[0]);
                const trackRightTrimSliderLeft = Number($(`#trackRightTrimSlider${globalMusicTracks.tracks[i].id}`).css('left').split('px')[0]);

                // update waveform
                $(`#waveform${globalMusicTracks.tracks[i].id}`).css(
                    {
                        'width': waveformWidth * 0.5 + 'px',
                        'left': waveformLeft * 0.5 + 'px',
                    }
                );

                globalMusicTracks.tracks[i].ws.zoom(46.6 * globalCurrentZoomLevel);

                // update vertical lines
                $(`#verticalTrackBeginLine${globalMusicTracks.tracks[i].id}`).css('left', verticalTrackBeginLineLeft * 0.5 + 'px');
                $(`#verticalTrackEndLine${globalMusicTracks.tracks[i].id}`).css('left', verticalTrackEndLineLeft * 0.5 + 'px');

                // update trim slider
                $(`#trackLeftTrimSlider${globalMusicTracks.tracks[i].id}`).css('left', trackLeftTrimSliderLeft * 0.5 + 'px');
                $(`#trackRightTrimSlider${globalMusicTracks.tracks[i].id}`).css('left', trackRightTrimSliderLeft * 0.5 + 'px');

                $(`#leftTrim${globalMusicTracks.tracks[i].id}`).css('width', trackLeftTrimSliderLeft * 0.5 + 'px');
                $(`#rightTrim${globalMusicTracks.tracks[i].id}`).css('width', (waveformWidth - trackRightTrimSliderLeft) * 0.5 + 'px');
            }

            if (globalCurrentZoomLevel === 0.125) {
                $('.zoomOut').css('opacity', 0.5).prop('disabled', true);
                $('.zoomIn').css('opacity', 1).prop('disabled', false);
            }
            else {
                $('.zoomOut').css('opacity', 1).prop('disabled', false);
                $('.zoomIn').css('opacity', 1).prop('disabled', false);
            }

            // loading icon------------------------------------
            $('#loading').css('display', 'none');

        }, 200);

    });




    function scrollMixingContainer() {
        if (globalIsPlaying) {
            const animateLineLeft = parseFloat($('#animateThisBar').css('left').split('px')[0]);

            const containerWidth = $('#mixingScrollDiv').width();

            const timePassedPercentage = animateLineLeft / containerWidth;

            const offsetX = $(`#mixingContainer`).width() / 2;

            document.getElementById('mixingContainer').scrollLeft = containerWidth * timePassedPercentage - offsetX;

        }
    }




    function moveTrackEndSlider(newId) {
        const width = $(`#waveform${newId}`).width();

        $('#trackEndSlider').css('left', width);
        $('#activeTrackDiv').css('width', width);
    }



    function checkPreventMovingTrackLessThanZero() {
        for (let i = 0; i < globalMusicTracks.tracks.length; i++) {
            const left = parseFloat($(`#waveform${globalMusicTracks.tracks[i].id}`).css('left').split('px')[0]);

            if (left < 0) {
                $(`#waveform${globalMusicTracks.tracks[i].id}`).css('left', 0);
            }
        }
    }


    function updateLeftTrimSliderZIndex(el) {

        const isLeftSlider = $(el).hasClass('trackLeftTrimSlider');

        if (isLeftSlider) {
            const containerWidth = $(el).closest('.waveform').width();
            const leftValue = $(el).css('left').split('px')[0];

            const leftTrimPercentage = leftValue / containerWidth * 100;

            if (leftTrimPercentage > 80) {
                $(el).css('z-index', 8);
            }
            else {
                $(el).css('z-index', 6);
            }
        }
    }


    $('#trackEndSliderContainer').on('click', function (e) {
        if (e.target.id === 'trackEndSliderContainer') {
            const x = e.offsetX;

            $('#animateThisBarHandle').css('left', x);
            $('#animateThisBar').css('left', x);
        }
    });



    $('#trackDetailPanel').on('input', '.volumeSlider', function () {
        const newVolume = this.value;

        const id = $(this).closest('.trackDetailListItem').attr('data-id');

        const index = globalMusicTracks.tracks.findIndex(function (val) {
            return val.id === id;
        });

        globalMusicTracks.tracks[index].ws.setVolume(newVolume);

        // update data
        globalMusicTracks.tracks[index].volume = newVolume;
    });



    $('#trackDetailPanel').on('click', '.muteButton', function () {
        const isMute = $(this).attr('data-mute');

        const id = $(this).closest('.trackDetailListItem').attr('data-id');

        const index = globalMusicTracks.tracks.findIndex(function (val) {
            return val.id === id;
        });

        if (isMute == 'false') {
            $(this).html('<i class="fas fa-volume-mute" style="font-size: 18px; color: #d6d6d6;"></i>');

            globalMusicTracks.tracks[index].ws.setMute(true);

            // update data
            globalMusicTracks.tracks[index].mute = true;

            // update dom
            $(this).attr('data-mute', 'true');
        }
        else {
            $(this).html('<i class="fas fa-volume-up" style="font-size: 16px; color: #d6d6d6;"></i>');

            globalMusicTracks.tracks[index].ws.setMute(false);

            // update data
            globalMusicTracks.tracks[index].mute = false;

            // update dom
            $(this).attr('data-mute', 'false');
        }
    });



    function moveBackTrackEndSliderWhenMovingTrack(el) {
        const left = $(el).css('left').split('px')[0];
        const width = $(el).css('width').split('px')[0];

        const elementEnd = parseFloat(left) + parseFloat(width);

        const trackEndSliderPosition = parseFloat($('#trackEndSlider').css('left').split('px')[0]);

        if (elementEnd > trackEndSliderPosition) {
            // move end slider
            $('#trackEndSlider').css('left', elementEnd + 'px');
            $('#activeTrackDiv').css('width', elementEnd + 'px');
        }
    }



    function updateHeightOfVerticalTrackLine() {
        const containerHeight = document.getElementById('mixingContainer').clientHeight;

        for (let i = 0; i < globalMusicTracks.tracks.length; i++) {
            $(`#verticalTrackBeginLine${globalMusicTracks.tracks[i].id}, #verticalTrackEndLine${globalMusicTracks.tracks[i].id}`).css('height', containerHeight + 'px');
        }

    }


    $('#showHideTrackDetailPanelButton').on('click', function (e) {
        $('#trackDetailPanel').show();

        // set width 100% or 300px
        const screenWidth = $(window).width();

        if (screenWidth <= 590) {
            const tabContentWidth = parseFloat($('.tabcontent').css('width').split('px')[0]);
            $('#trackDetailPanel').css('width', tabContentWidth + 'px');
        }
        else {
            $('#trackDetailPanel').css('width', '500px');
        }

        const panelWidth = parseFloat($('#trackDetailPanel').css('width').split('px')[0]);
        const tabcontentPaddingLeft = parseFloat($('.tabcontent').css('padding-left').split('px')[0]);

        $('#trackDetailPanel').css('left', '-' + tabcontentPaddingLeft + 'px');
    });


    $('#closeTrackDetailPanelButton').on('click', function () {
        const panelWidth = parseFloat($('#trackDetailPanel').css('width').split('px')[0]);
        const tabcontentPaddingLeft = parseFloat($('.tabcontent').css('padding-left').split('px')[0]);

        $('#trackDetailPanel').css('left', '-' + panelWidth - tabcontentPaddingLeft + 'px');
    });



    $('#appendDetailHere').on('click', '.deleteTrackButton', function () {
        globalDeleteTrackId = $(this).closest('.trackDetailListItem').attr('data-id');

        const index = globalMusicTracks.tracks.findIndex(function (val) {
            return val.id === globalDeleteTrackId;
        });

        $('#deleteTrackTitle').text(globalMusicTracks.tracks[index].title);

        $('#deleteTrackModal').css('display', 'flex');
    });

    $('#appendDetailHere').on('blur', '.trackTitleInput', function () {
        const newTitle = $(this).val().trim();

        const trackId = $(this).closest('.trackDetailListItem').attr('data-id');

        const index = globalMusicTracks.tracks.findIndex(function (val) {
            return val.id === trackId;
        });

        globalMusicTracks.tracks[index].title = newTitle;

        $(`#tackTitleAboveWaveformSpan${trackId}`).text(newTitle);

    });

    $('#appendDetailHere').on('blur', '.trackDescription', function () {
        const newDescription = $(this).val().trim();

        const trackId = $(this).closest('.trackDetailListItem').attr('data-id');

        const index = globalMusicTracks.tracks.findIndex(function (val) {
            return val.id === trackId;
        });

        globalMusicTracks.tracks[index].description = newDescription;
    });



    $('.closeDeleteTrackModal').on('click', function () {
        $('#deleteTrackModal').css('display', 'none');
    });


    $('.confirmDeleteTrackButton').on('click', function () {
        const index = globalMusicTracks.tracks.findIndex(function (val) {
            return val.id === globalDeleteTrackId;
        });

        // update data
        globalMusicTracks.tracks.splice(index, 1);
        audioFiles.splice(index, 1);

        // update ui
        $(`#trackDetail${globalDeleteTrackId}`).remove();
        $(`#panelSpacing${globalDeleteTrackId}`).remove();
        $(`#waveform${globalDeleteTrackId}`).remove();
        $(`#verticalTrackBeginLine${globalDeleteTrackId}`).remove();
        $(`#verticalTrackEndLine${globalDeleteTrackId}`).remove();

        $('#deleteTrackModal').css('display', 'none');

        updateWaveformYaxis();
        updateMixingContainerHeight();
        updateAnimateThisBarHeight();
        updateHeightOfVerticalTrackLine();
        updateDetailPanelHeight();
        hideElementsIfNoTracks();

        // disble buttons and message if no tracks
        if (globalMusicTracks.tracks.length === 0) {
            $('.zoomOut').css('opacity', 0.5).prop('disabled', true);
            $('.zoomIn').css('opacity', 0.5).prop('disabled', true);
            $('#playWaveFormButton').css('opacity', 0.5).prop('disabled', true);
            $('#openCombineTracksModal').css('opacity', 0.5).prop('disabled', true);

            $('#trackIsEmptyDiv').css('display', 'block');
        }
    });


    function updateDetailPanelHeight() {
        const newHeight = parseFloat(document.getElementById('mixingContainer').style.height.split('px')[0]);
        $('#appendDetailHere').css('height', newHeight - 30 + 'px');
    }


    function hideElementsIfNoTracks() {
        if (globalMusicTracks.tracks.length === 0) {
            $('#mixingContainer').css('height', 0);
            $('#showHideTrackDetailPanelButton').hide();
            $('#trackDetailPanel').hide();
            $('#closeTrackDetailPanelButton').trigger('click');
        }
    }



    function appendTrimSliderAndLock(trackId, trackTitle) {
        $(`#waveform${trackId}`).append(`
            <div class='waveformOverlay' id='waveformOverlay${trackId}'></div>
            <div class='tackTitleAboveWaveform' id='tackTitleAboveWaveform${trackId}'>
                <span class='lockIconAboveWaveform' id='lockIconAboveWaveformSpan${trackId}'><i class="fas fa-lock-open" style='color: rgba(56, 120, 81, 0.5); margin-left: 4px;'></i></span><span id='tackTitleAboveWaveformSpan${trackId}'>${trackTitle}</span>
            </div>
            <div id='leftTrim${trackId}' class='leftTrim'></div>
            <div id='rightTrim${trackId}' class='rightTrim'></div>
            <div class='trimSliderContainer'>
                <div class='trackLeftTrimSlider' id='trackLeftTrimSlider${trackId}'></div>
                <div class='trackRightTrimSlider' id='trackRightTrimSlider${trackId}'></div>                        
            </div>
        `);

        // update slider position
        $(`#trackLeftTrimSlider${trackId}`).css('transform', `translate(-16px, -6px)`);
        $(`#trackRightTrimSlider${trackId}`).css('transform', `translate(-16px, -6px)`);

    }


    function appendVericalTrackBeginEndLines(trackId, waveformWidth, color) {
        $('#mixingScrollDiv').append(`
            <div class='verticalTrackBeginLine' id='verticalTrackBeginLine${trackId}'></div>
            <div class='verticalTrackEndLine' id='verticalTrackEndLine${trackId}'></div>
        `);

        // style vertical lines
        $(`#verticalTrackBeginLine${trackId}`).css({
            'top': 0,
            'left': 0,
            'background-color': '#' + color,
            'width': '1px',
        });

        $(`#verticalTrackEndLine${trackId}`).css({
            'top': 0,
            'left': waveformWidth * globalCurrentZoomLevel + 'px',
            'background-color': '#' + color,
            'width': '1px',
        });
    }


    function appendTrackDetail(trackId, trackTitle, trackDescription) {
        $('#appendDetailHere').append(`
            <div class='trackDetailListItem' id='trackDetail${trackId}' data-id='${trackId}'>
                <div style='padding-top: 5px;' class='disp-flex align-items--center flex-wrap-nowrap'>
                    <div class='flex-100' style='padding-right: 6px;'>
                        <input class='trackTitleInput' type='text' placeholder='Add Track Name' value='${trackTitle}'>                            
                    </div>
                    <button type='button' class='deleteTrackButton roundButton'><i class="fas fa-trash-alt" style='color: #d6d6d6;'></i></button>
                </div>

                <div class='disp-flex justify-content--end align-items--center padding-top-1'>
                    <input class='volumeSlider' type='range' min='0' max='1' value='0.5' step='0.1'>                        
                    <button class='muteButton roundButton' type='button' data-mute='false'><i class="fas fa-volume-up" style='font-size: 16px; color: #d6d6d6;'></i></button> 
                </div>

                <div style='padding-top: 15px;'>
                    <textarea placeholder='Add description' class='trackDescription' rows='2'>${trackDescription}</textarea>
                </div>
            </div>
        `);

        // fix height of new trackDetail
        $(`#trackDetail${trackId}`).css('height', globalWaveformHeight + globalWaveformHeightPaddingTop + 'px');
    }


    function updateUIfromSavedData(musicTrackObj) {
        // track
        $(`#waveform${musicTrackObj.id}`).css('left', musicTrackObj.left * globalCurrentZoomLevel + 'px');

        $(`#leftTrim${musicTrackObj.id}`).css('width', musicTrackObj.leftTrim * globalCurrentZoomLevel + 'px');
        $(`#rightTrim${musicTrackObj.id}`).css('width', (musicTrackObj.containerWidth - musicTrackObj.rightTrim) * globalCurrentZoomLevel + 'px');

        $(`#trackLeftTrimSlider${musicTrackObj.id}`).css('left', musicTrackObj.leftTrim * globalCurrentZoomLevel + 'px');
        $(`#trackRightTrimSlider${musicTrackObj.id}`).css('left', musicTrackObj.rightTrim * globalCurrentZoomLevel + 'px');

        $(`#verticalTrackBeginLine${musicTrackObj.id}`).css('left', (musicTrackObj.left + musicTrackObj.leftTrim) * globalCurrentZoomLevel + 'px');
        $(`#verticalTrackEndLine${musicTrackObj.id}`).css('left', (musicTrackObj.left + musicTrackObj.rightTrim) * globalCurrentZoomLevel + 'px');

        if (musicTrackObj.lock === true) {
            $(`#lockIconAboveWaveformSpan${musicTrackObj.id}`).trigger('click');
        }

        // detail panel
        $(`#trackDetail${musicTrackObj.id}`).find('.volumeSlider').val(musicTrackObj.volume);

        if (musicTrackObj.mute === true) {
            $(`#trackDetail${musicTrackObj.id}`).find('.muteButton').trigger('click');
        }
    }


    function updateTrackEndSliderFromSavedData(position) {
        $('#trackEndSlider').css('left', position * globalCurrentZoomLevel + 'px');
        $('#activeTrackDiv').css('width', position * globalCurrentZoomLevel + 'px');
    }



    $('#mixingContainer').on('click', '.lockIconAboveWaveform', function (e) {
        e.preventDefault();

        const dataDrag = $(this).closest('.waveform').attr('data-drag');

        const trackId = $(this).closest('.waveform').attr('data-trackid');

        const index = globalMusicTracks.tracks.findIndex(function (val) {
            return val.id === trackId;
        });

        if (dataDrag === 'true') {
            $(this).closest('.waveform').attr('data-drag', 'false');
            $(`#lockIconAboveWaveformSpan${trackId}`).html(`<i class="fas fa-lock" style='color: rgba(170, 67, 18, 0.5); margin-left: 4px;'></i>`);
            $(`#waveformOverlay${trackId}`).css('background-color', '#dbb5b56b');

            globalMusicTracks.tracks[index].lock = true;
        }
        else {
            $(this).closest('.waveform').attr('data-drag', 'true');
            $(`#lockIconAboveWaveformSpan${trackId}`).html(`<i class="fas fa-lock-open" style='color: rgba(56, 120, 81, 0.5); margin-left: 4px;'></i>`);
            $(`#waveformOverlay${trackId}`).css('background-color', 'transparent');

            globalMusicTracks.tracks[index].lock = false;
        }
    });



    function loadProject() {
        // loading icon------------------------------------
        $('#loading').css('display', 'flex');

        // reset
        globalMusicTracks.tracks = [];
        $('.waveform').remove();
        $('.verticalTrackBeginLine').remove();
        $('.verticalTrackEndLine').remove();
        $('.trackDetailListItem').remove();

        globalMusicTracks.total_duration = 57.72857142857143;
        globalMusicTracks.trackEndSliderPosition = 2694;

        globalMusicTracks.tracks = [
            {
                description: 'Alternative dance, edm, electro house, house, new rave.',
                duration: 58.671,
                mute: false,
                title: "calvin_harris_-_how_deep_is_your_love_(acapella).mp3",
                volume: 0.4,
                lock: false,
                containerWidth: 2736,
                endPlayPixel: 2874,
                id: "eeeaaa2f-acee-a7c9-878d-d97777927170",
                left: 138,
                leftTrim: 371,
                playStarted: false,
                rightTrim: 2736,
                startPlayPixel: 509,
                audioFileUrl: './assets/calvin_harris_-_how_deep_is_your_love_(acapella).mp3',
            },
            {
                description: 'Soundtrack, Ambient Electronic, Downtempo, Instrumental.',
                duration: 65,
                mute: false,
                title: "Good Ketsa_-_10_-_Memories_Renewed.mp3",
                volume: 0.5,
                lock: false,
                containerWidth: 3031.14,
                endPlayPixel: 2838,
                id: "398973ee-75fe-0562-a411-c570f2e3f81e",
                left: 0,
                leftTrim: 0,
                playStarted: false,
                rightTrim: 2838,
                startPlayPixel: 0,
                audioFileUrl: './assets/Good Ketsa_-_10_-_Memories_Renewed.mp3',
            },
            {
                description: "Relaxation and tranquility with calming soothing instrumental.",
                duration: 68,
                mute: false,
                title: "Tranquility_-_David_Renda_2019-04-26.mp3",
                volume: 0.1,
                lock: false,
                containerWidth: 3171.04,
                endPlayPixel: 2875,
                id: "de5a560e-b185-fc9a-a06f-0f9bcbf11542",
                left: 0,
                leftTrim: 193,
                playStarted: true,
                rightTrim: 2875,
                startPlayPixel: 193,
                audioFileUrl: './assets/Tranquility_-_David_Renda_2019-04-26.mp3',
            },
            {
                description: 'Soothing relaxation ocean edge background music.',
                duration: 9.47375,
                mute: false,
                title: "Relaxing_background_ocean_edge.mp3",
                volume: 0.1,
                lock: false,
                containerWidth: 441.788,
                endPlayPixel: 693.788,
                id: "f3d577ef-c228-2b62-1bcc-21d8af8bcb48",
                left: 252,
                leftTrim: 0,
                playStarted: false,
                rightTrim: 441.788,
                startPlayPixel: 252,
                audioFileUrl: './assets/Relaxing_background_ocean_edge.mp3',
            }
        ];

        for (let i = 0; i < globalMusicTracks.tracks.length; i++) {
            audioFiles.push({
                'audioFile': globalMusicTracks.tracks[i].audioFileUrl,
                'isInputFile': false,
            });
        }

        loadNewAudioTrack('', '', 'false');

    }

    function guid() {
        function s4() {
            return Math.floor((1 + Math.random()) * 0x10000)
                .toString(16)
                .substring(1);
        }
        return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
            s4() + '-' + s4() + s4() + s4();
    }


    function getTrackInfo() {
        // get total duration
        const trackEndSliderPosition = Number($('#trackEndSlider').css('left').split('px')[0]);
        const totalDurationPixel = Number($('#displayScale').css('width').split('px')[0]);
        const durationPercentage = trackEndSliderPosition / totalDurationPixel;

        const totalActiveDurationInSec = 600 * durationPercentage;

        globalMusicTracks.trackEndSliderPosition = trackEndSliderPosition;
        globalMusicTracks.total_duration = totalActiveDurationInSec;

        // get trak info and globalMusicTrackX
        globalMusicTrackX = [];
        for (let i = 0; i < globalMusicTracks.tracks.length; i++) {
            const trackLeft = Number($(`#waveform${globalMusicTracks.tracks[i].id}`).css('left').split('px')[0]);

            const leftTrimValue = Number($(`#trackLeftTrimSlider${globalMusicTracks.tracks[i].id}`).css('left').split('px')[0]);
            const rightTrimValue = Number($(`#trackRightTrimSlider${globalMusicTracks.tracks[i].id}`).css('left').split('px')[0]);

            const containerWidth = $(`#waveform${globalMusicTracks.tracks[i].id}`).width();
            const containerLeft = Number($(`#waveform${globalMusicTracks.tracks[i].id}`).css('left').split('px')[0]);

            const leftTrimPercentage = leftTrimValue / containerWidth;
            const rightTrimPercentage = rightTrimValue / containerWidth;

            // update web audio api 'offset' value
            const startPlaySec = globalMusicTracks.tracks[i].duration * leftTrimPercentage;
            const endPlaySec = globalMusicTracks.tracks[i].duration * rightTrimPercentage;

            const startPlayPixel = containerLeft + leftTrimValue;
            const endPlayPixel = containerLeft + rightTrimValue;

            globalMusicTrackX.push({
                left: trackLeft,
                id: globalMusicTracks.tracks[i].id,
                playStarted: false,
                leftTrim: leftTrimValue,
                rightTrim: rightTrimValue,
                startPlayPixel: startPlayPixel,
                endPlayPixel: endPlayPixel,
                track_start: startPlaySec,
                track_end: endPlaySec,
                containerWidth: containerWidth,
            });


            // get track info
            const newDescription = $(`#trackDetail${globalMusicTracks.tracks[i].id}`).find('.trackDescription').val().trim();
            const newTitle = $(`#trackDetail${globalMusicTracks.tracks[i].id}`).find('.trackTitleInput').val().trim();
            const newVolume = $(`#trackDetail${globalMusicTracks.tracks[i].id}`).find('.volumeSlider').val();
            const newMute = $(`#trackDetail${globalMusicTracks.tracks[i].id}`).find('.muteButton').attr('data-mute');

            // update start duration relative to total duration. Web audio api 'start' value
            const trackWillStartPercentage = (trackLeft + leftTrimValue) / totalDurationPixel;
            const trackWillStartSec = 600 * trackWillStartPercentage;

            // update track will end. Web audio api 'duration' value
            let trackEndDurationIncludesOffsetPercentage = rightTrimValue / containerWidth;
            let trackEndDurationExcludeOffsetPercentage = globalMusicTracks.tracks[i].duration * trackEndDurationIncludesOffsetPercentage;

            // re-calculate trackEndDrutation if track finishes before rightTrim slider
            if (trackEndSliderPosition < (containerLeft + rightTrimValue)) {
                // make duration 0 if track finishes before leftTrim slider
                if (trackEndSliderPosition < (containerLeft + leftTrimValue)) {
                    trackEndDurationExcludeOffsetPercentage = 0;
                }
                else {
                    // if track finishes before right slider
                    trackEndDurationExcludeOffsetPercentage = (trackEndSliderPosition - containerLeft - leftTrimValue) / containerWidth;
                    trackEndDurationExcludeOffsetSec = globalMusicTracks.tracks[i].duration * trackEndDurationExcludeOffsetPercentage;                    
                }
            }

            globalMusicTracks.tracks[i].description = newDescription;
            globalMusicTracks.tracks[i].title = newTitle;
            globalMusicTracks.tracks[i].volume = newVolume;
            globalMusicTracks.tracks[i].mute = newMute;
            globalMusicTracks.tracks[i].track_start = startPlaySec;
            globalMusicTracks.tracks[i].track_end = endPlaySec;
            globalMusicTracks.tracks[i].track_will_start = trackWillStartSec;
            globalMusicTracks.tracks[i].track_will_end = trackWillStartSec + trackEndDurationExcludeOffsetSec;
            globalMusicTracks.tracks[i].left = trackLeft;
            globalMusicTracks.tracks[i].leftTrim = leftTrimValue;
            globalMusicTracks.tracks[i].rightTrim = rightTrimValue;
            globalMusicTracks.tracks[i].startPlayPixel = startPlayPixel;
            globalMusicTracks.tracks[i].endPlayPixel = endPlayPixel;
            globalMusicTracks.tracks[i].containerWidth = containerWidth;

        }

        // console.log('globalMusicTracks: ', globalMusicTracks);
        // console.log('globalMusicTrackX: ', globalMusicTrackX);
    }


    loadProject();

    // =============================================================

    var div = document.querySelector("#thisDiv");

    function handleFilesSelect(files) {
        div.innerHTML = "loading...";
        var duration = (globalMusicTracks.total_duration * 1000).toFixed(0);
        var chunks = [];
        var AudioContext = window.AudioContext || window.webkitAudioContext;
        var audio = new AudioContext();
        var mixedAudio = audio.createMediaStreamDestination();
        var context;
        var recorder;
        var description = "finalAudioFile";

        function get(file) {
            // if user upload audio file, user filereader to read contents of file
            if (file.isInputFile === true) {
                return new Promise(function (resolve, reject) {
                    var reader = new FileReader;
                    reader.readAsArrayBuffer(file.audioFile);
                    reader.onload = function () {
                        resolve(reader.result)
                    }
                });
            }
            else {
                // if url load
                return fetch(file.audioFile)
                    .then(function (response) {
                        return response.arrayBuffer();
                    });
            }
        }


        function stopMix(duration, ...media) {
            setTimeout(function (media) {
                media.forEach(function (node) {
                    node.stop();
                })
            }, duration, media)
        }

        Promise.all(files.map(get))
            .then(function (data) {
                var len = Math.max.apply(Math, data.map(function (buffer) {
                    return buffer.byteLength
                }));
                context = new OfflineAudioContext(2, len, 44100);
                return Promise.all(data.map(function (buffer, i) {
                    return audio.decodeAudioData(buffer)
                        .then(function (bufferSource) {

                            // change volume======================================
                            var gainNode = context.createGain();
                            var source = context.createBufferSource();
                            source.buffer = bufferSource;
                            source.connect(gainNode);
                            // set volume
                            gainNode.gain.setValueAtTime(globalMusicTracks.tracks[i].volume, context.currentTime);
                            gainNode.connect(context.destination);

                            // set begin, offset and duration==============================
                            // use i to choose audio file
                            // source.start(when, offset, duration)

                            return source.start(context.currentTime + globalMusicTracks.tracks[i].track_will_start.toFixed(1), globalMusicTracks.tracks[i].track_start.toFixed(1), globalMusicTracks.tracks[i].track_will_end.toFixed(1));
                            

                        })
                }))
                    .then(function () {
                        return context.startRendering()
                    })
                    .then(function (renderedBuffer) {
                        return new Promise(function (resolve) {
                            var mix = audio.createBufferSource();
                            mix.buffer = renderedBuffer;
                            mix.connect(audio.destination);
                            mix.connect(mixedAudio);
                            recorder = new MediaRecorder(mixedAudio.stream);
                            recorder.start(0);
                            mix.start(0);
                            div.innerHTML = "Playing and recording tracks.";
                            // stop playback and recorder in 60 seconds
                            stopMix(duration, mix, recorder)

                            recorder.ondataavailable = function (event) {
                                chunks.push(event.data);
                            };

                            recorder.onstop = function (event) {
                                var blob = new Blob(chunks, {
                                    "type": "audio/ogg; codecs=opus"
                                });
                                console.log("recording complete");
                                resolve(blob)
                            };
                        })
                    })
                    .then(function (blob) {
                        div.innerHTML = "Mixed audio tracks ready for download.";
                        var audioDownload = URL.createObjectURL(blob);
                        var a = document.getElementById('downloadFinalTrack');
                        a.download = description + "." + blob.type.replace(/.+\/|;.+/g, "");
                        a.href = audioDownload;

                        $('#processingIcon').hide();
                        $('#downloadFinalTrack').show();
                        $('.closeResultModal').css('display', 'flex');

                        // loading icon------------------------------------
                        $('#loading').css('display', 'none');
                    })
            })
            .catch(function (e) {
                alert(e);
                console.log(e)
            });

    }

});