(function () {
    var root = document.getElementById("audio-transcription");
    if (!root) return;

    var dropzone = document.getElementById("audio-transcription-dropzone");
    var fileInput = document.getElementById("audio-transcription-input");
    var states = {
        idle: root.querySelector('[data-state="idle"]'),
        processing: root.querySelector('[data-state="processing"]'),
        done: root.querySelector('[data-state="done"]'),
    };
    var steps = {
        upload: root.querySelector('[data-step="upload"]'),
        transcribe: root.querySelector('[data-step="transcribe"]'),
        done: root.querySelector('[data-step="done"]'),
    };

    var processingFilename = document.getElementById("audio-transcription-processing-filename");
    var processingMeta = document.getElementById("audio-transcription-processing-meta");
    var statusLine = document.getElementById("audio-transcription-status-line");
    var etaLine = document.getElementById("audio-transcription-eta-line");

    var doneFilename = document.getElementById("audio-transcription-done-filename");
    var doneMeta = document.getElementById("audio-transcription-done-meta");
    var linkEl = document.getElementById("audio-transcription-link");
    var copyBtn = document.getElementById("audio-transcription-copy");
    var downloadBtn = document.getElementById("audio-transcription-download");
    var resetLink = document.getElementById("audio-transcription-reset-link");

    var timers = [];
    var objectUrl = null;
    var copiedTimer = null;
    var current = { fileName: "", durationLabel: "—", s3Url: "" };

    function clearTimers() {
        timers.forEach(function (t) { clearTimeout(t); });
        timers = [];
    }

    function formatBytes(bytes) {
        if (!bytes) return "0 KB";
        if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + " MB";
        return Math.round(bytes / 1e3) + " KB";
    }

    function formatDuration(totalSeconds) {
        var total = Math.round(totalSeconds);
        var h = Math.floor(total / 3600);
        var m = Math.floor((total % 3600) / 60);
        var sec = total % 60;
        var pad = function (n) { return String(n).padStart(2, "0"); };
        return h > 0 ? (h + ":" + pad(m) + ":" + pad(sec)) : (m + ":" + pad(sec));
    }

    function slugify(fileName) {
        var name = fileName || "audio";
        var dot = name.lastIndexOf(".");
        var base = dot > 0 ? name.slice(0, dot) : name;
        var slug = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
        return slug || "audio";
    }

    function estimateEtaMinutes(durationSeconds) {
        return Math.max(2, Math.round((durationSeconds / 60) * 0.2));
    }

    function setActiveStep(name) {
        Object.keys(steps).forEach(function (key) {
            steps[key].classList.toggle("is-active", key === name);
        });
    }

    function showState(name) {
        Object.keys(states).forEach(function (key) {
            states[key].hidden = key !== name;
        });
    }

    function startFlow(file) {
        if (!file) return;
        clearTimers();

        var sizeLabel = formatBytes(file.size);
        var fileName = file.name || "audio-file";
        current.fileName = fileName;

        processingFilename.textContent = fileName;
        processingMeta.textContent = sizeLabel + " · —";
        statusLine.textContent = "Uploading…";
        etaLine.textContent = "Preparing audio…";

        showState("processing");
        setActiveStep("transcribe");

        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = URL.createObjectURL(file);

        var audioEl = new Audio();
        audioEl.preload = "metadata";
        audioEl.src = objectUrl;
        audioEl.onloadedmetadata = function () {
            var dur = isFinite(audioEl.duration) ? audioEl.duration : 0;
            var durationLabel = dur ? formatDuration(dur) : "—";
            var etaLabel = dur ? (estimateEtaMinutes(dur) + " min") : "a few minutes";
            current.durationLabel = durationLabel;
            processingMeta.textContent = sizeLabel + " · " + durationLabel;
            doneMeta.textContent = sizeLabel + " · " + durationLabel;
            etaLine.textContent = "Estimated " + etaLabel + " remaining";
        };
        audioEl.onerror = function () {
            etaLine.textContent = "Estimated a few minutes remaining";
        };

        timers.push(setTimeout(function () {
            statusLine.textContent = "Transcribing…";
        }, 1100));

        timers.push(setTimeout(function () {
            var slug = slugify(fileName);
            var s3Url = "https://s3.amazonaws.com/voice-transcripts/transcripts/" + slug + ".txt";
            current.s3Url = s3Url;

            doneFilename.textContent = fileName;
            linkEl.textContent = s3Url;
            copyBtn.textContent = "Copy link";

            showState("done");
            setActiveStep("done");
        }, 3300));
    }

    function resetFlow() {
        clearTimers();
        if (objectUrl) {
            URL.revokeObjectURL(objectUrl);
            objectUrl = null;
        }
        current = { fileName: "", durationLabel: "—", s3Url: "" };
        dropzone.classList.remove("is-drag-over");
        showState("idle");
        setActiveStep("upload");
    }

    function copyLink() {
        if (current.s3Url && navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(current.s3Url).catch(function () {});
        }
        copyBtn.textContent = "Copied";
        clearTimeout(copiedTimer);
        copiedTimer = setTimeout(function () {
            copyBtn.textContent = "Copy link";
        }, 1500);
    }

    function downloadStub() {
        var content = "Transcript\nSource file: " + (current.fileName || "audio") +
            "\nDuration: " + (current.durationLabel || "—") +
            "\n\n[Placeholder transcript text — connect a transcription backend to populate this file with real output.]\n";
        var blob = new Blob([content], { type: "text/plain" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = slugify(current.fileName) + ".txt";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    }

    dropzone.addEventListener("click", function () { fileInput.click(); });
    dropzone.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInput.click();
        }
    });
    dropzone.addEventListener("dragover", function (e) {
        e.preventDefault();
        dropzone.classList.add("is-drag-over");
    });
    dropzone.addEventListener("dragleave", function () {
        dropzone.classList.remove("is-drag-over");
    });
    dropzone.addEventListener("drop", function (e) {
        e.preventDefault();
        dropzone.classList.remove("is-drag-over");
        var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (file) startFlow(file);
    });
    fileInput.addEventListener("change", function (e) {
        var file = e.target.files && e.target.files[0];
        if (file) startFlow(file);
        e.target.value = "";
    });

    copyBtn.addEventListener("click", copyLink);
    downloadBtn.addEventListener("click", downloadStub);
    resetLink.addEventListener("click", function (e) {
        e.preventDefault();
        resetFlow();
    });

    window.addEventListener("beforeunload", function () {
        clearTimers();
        clearTimeout(copiedTimer);
        if (objectUrl) URL.revokeObjectURL(objectUrl);
    });
})();
