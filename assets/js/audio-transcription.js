(function () {
    var root = document.getElementById("audio-transcription");
    if (!root) return;

    function BusyError(message) {
        this.name = "BusyError";
        this.message = message;
    }
    BusyError.prototype = Object.create(Error.prototype);

    function UploadError(message) {
        this.name = "UploadError";
        this.message = message;
    }
    UploadError.prototype = Object.create(Error.prototype);

    function extractS3ErrorMessage(responseText) {
        if (!responseText) return null;
        var match = /<Message>([^<]*)<\/Message>/.exec(responseText);
        return match ? match[1] : null;
    }

    var JOB_URL = "https://fhotcnzhy3vowhhvg3usulozai0ufpjj.lambda-url.eu-central-1.on.aws/job";
    var STATUS_URL = "https://fhotcnzhy3vowhhvg3usulozai0ufpjj.lambda-url.eu-central-1.on.aws/status/";
    var POLL_INTERVAL_MS = 10000;
    var MAX_DURATION_SECONDS = 2 * 60 * 60;

    var FOOTNOTES = {
        idle: "This demo only processes one audio file every 5 hours — thanks for your patience.",
        createJob: "This demo only processes one audio file every 5 hours — thanks for your patience.",
        upload: "Max file size is 3GB, max audio length is 5 hours.",
        process: "Hang tight — this can take a little while.",
        transcribe: "Powered by Qwen3-ASR-1.7B. Hang tight — this can take a little while.",
        done: "Download or copy your link now — nothing is saved after this session.",
        failed: "Hit an error unrelated to the 5-hour cycle, file size, or audio length? Email me at <a href=\"mailto:oluwatosinaina424@gmail.com\">oluwatosinaina424@gmail.com</a>.",
    };

    var dropzone = document.getElementById("audio-transcription-dropzone");
    var fileInput = document.getElementById("audio-transcription-input");
    var states = {
        idle: root.querySelector('[data-state="idle"]'),
        processing: root.querySelector('[data-state="processing"]'),
        error: root.querySelector('[data-state="error"]'),
        done: root.querySelector('[data-state="done"]'),
    };
    var steps = {
        createJob: root.querySelector('[data-step="create-job"]'),
        upload: root.querySelector('[data-step="upload"]'),
        process: root.querySelector('[data-step="process"]'),
        transcribe: root.querySelector('[data-step="transcribe"]'),
        done: root.querySelector('[data-step="done"]'),
    };
    var stepsBar = document.getElementById("audio-transcription-steps");
    var stepsBarFailed = document.getElementById("audio-transcription-steps-failed");

    var processingFilename = document.getElementById("audio-transcription-processing-filename");
    var processingMeta = document.getElementById("audio-transcription-processing-meta");
    var statusLine = document.getElementById("audio-transcription-status-line");
    var progressBar = root.querySelector(".audio-transcription-progress-bar");
    var footnoteEl = document.getElementById("audio-transcription-footnote");

    var errorFilename = document.getElementById("audio-transcription-error-filename");
    var errorMeta = document.getElementById("audio-transcription-error-meta");
    var errorMessage = document.getElementById("audio-transcription-error-message");
    var errorResetLink = document.getElementById("audio-transcription-error-reset-link");

    var doneFilename = document.getElementById("audio-transcription-done-filename");
    var doneMeta = document.getElementById("audio-transcription-done-meta");
    var linkEl = document.getElementById("audio-transcription-link");
    var copyBtn = document.getElementById("audio-transcription-copy");
    var downloadBtn = document.getElementById("audio-transcription-download");
    var resetLink = document.getElementById("audio-transcription-reset-link");

    var pollTimer = null;
    var objectUrl = null;
    var copiedTimer = null;
    var activeXhr = null;
    var abortController = null;
    var current = { fileName: "", sizeLabel: "", durationLabel: "—", transcriptUrl: "" };

    function clearPollTimer() {
        if (pollTimer) {
            clearTimeout(pollTimer);
            pollTimer = null;
        }
    }

    function setProgress(percent) {
        progressBar.classList.add("is-determinate");
        progressBar.style.width = Math.max(0, Math.min(100, percent)) + "%";
    }

    function setProgressIndeterminate() {
        progressBar.classList.remove("is-determinate");
        progressBar.style.width = "";
    }

    function abortInFlight() {
        if (activeXhr) {
            activeXhr.abort();
            activeXhr = null;
        }
        if (abortController) {
            abortController.abort();
            abortController = null;
        }
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

    function setActiveStep(name) {
        Object.keys(steps).forEach(function (key) {
            steps[key].classList.toggle("is-active", key === name);
        });
    }

    function setFootnote(html) {
        footnoteEl.innerHTML = html;
    }

    function setStage(stepKey, label) {
        setActiveStep(stepKey);
        statusLine.textContent = label;
        if (FOOTNOTES[stepKey]) setFootnote(FOOTNOTES[stepKey]);
    }

    function showState(name) {
        Object.keys(states).forEach(function (key) {
            states[key].hidden = key !== name;
        });
    }

    function showError(message) {
        clearPollTimer();
        setProgressIndeterminate();
        errorFilename.textContent = current.fileName;
        errorMeta.textContent = current.sizeLabel + " · " + current.durationLabel;
        errorMessage.textContent = message;
        showState("error");
        stepsBar.hidden = true;
        stepsBarFailed.hidden = false;
        setFootnote(FOOTNOTES.failed);
    }

    function startFlow(file) {
        if (!file) return;
        clearPollTimer();
        abortInFlight();

        var sizeLabel = formatBytes(file.size);
        var fileName = file.name || "audio-file";
        current.fileName = fileName;
        current.sizeLabel = sizeLabel;
        current.durationLabel = "—";
        current.transcriptUrl = "";

        processingFilename.textContent = fileName;
        processingMeta.textContent = sizeLabel + " · —";
        statusLine.textContent = "Checking audio…";
        setProgressIndeterminate();

        stepsBarFailed.hidden = true;
        stepsBar.hidden = false;
        showState("processing");
        setActiveStep(null);

        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = URL.createObjectURL(file);

        var audioEl = new Audio();
        audioEl.preload = "metadata";
        audioEl.src = objectUrl;
        audioEl.onloadedmetadata = function () {
            var dur = isFinite(audioEl.duration) ? audioEl.duration : 0;
            if (dur > MAX_DURATION_SECONDS) {
                current.durationLabel = formatDuration(dur);
                showError("Audio duration is too long");
                return;
            }
            var durationLabel = dur ? formatDuration(dur) : "—";
            current.durationLabel = durationLabel;
            processingMeta.textContent = sizeLabel + " · " + durationLabel;
            doneMeta.textContent = sizeLabel + " · " + durationLabel;
            uploadAndTranscribe(file);
        };
        audioEl.onerror = function () {
            uploadAndTranscribe(file);
        };
    }

    function uploadAndTranscribe(file) {
        setStage("createJob", "Creating Job…");
        setProgressIndeterminate();

        abortController = new AbortController();
        var signal = abortController.signal;

        fetch(JOB_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
            signal: signal,
        })
            .then(function (res) {
                if (res.status === 429) {
                    return res.json().then(function (errBody) {
                        throw new BusyError((errBody && errBody.message) || "The transcription service is at capacity. Please try again later.");
                    });
                }
                if (!res.ok) {
                    return res.text().then(function (text) {
                        console.error("Job creation failed:", res.status, text);
                        throw new Error("job-create-failed");
                    });
                }
                return res.json();
            })
            .then(function (body) {
                var data = body.data;
                var jobId = data.job_id;
                var presigned = JSON.parse(data.presigned_url);

                setStage("upload", "Uploading… 0%");
                setProgress(0);

                return uploadToS3(presigned, file).then(function () {
                    setProgressIndeterminate();
                    pollStatus(jobId);
                });
            })
            .catch(function (err) {
                if (err && err.name === "AbortError") return;
                if (err instanceof BusyError || err instanceof UploadError) {
                    showError(err.message);
                    return;
                }
                console.error("Transcription flow failed:", err);
                showError("Something went wrong while starting the transcription. Please try again.");
            });
    }

    function uploadToS3(presigned, file) {
        return new Promise(function (resolve, reject) {
            var formData = new FormData();
            Object.keys(presigned.fields).forEach(function (key) {
                formData.append(key, presigned.fields[key]);
            });
            formData.append("Content-Type", file.type || "audio/mpeg");
            formData.append("file", file);

            var xhr = new XMLHttpRequest();
            activeXhr = xhr;
            xhr.open("POST", presigned.url, true);

            xhr.upload.onprogress = function (e) {
                if (!e.lengthComputable) return;
                var percent = Math.round((e.loaded / e.total) * 100);
                setProgress(percent);
                statusLine.textContent = "Uploading… " + percent + "%";
            };

            xhr.onload = function () {
                activeXhr = null;
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve();
                } else {
                    console.error("S3 upload failed:", xhr.status, xhr.responseText);
                    var s3Message = extractS3ErrorMessage(xhr.responseText);
                    reject(new UploadError(s3Message || ("Upload to storage failed (status " + xhr.status + "). Please try again.")));
                }
            };

            xhr.onerror = function () {
                activeXhr = null;
                console.error("S3 upload network error (often a CORS or connectivity issue). Check the Network tab for the failed request to", presigned.url);
                reject(new UploadError("Upload to storage failed — a network or CORS error occurred. Please try again."));
            };

            xhr.onabort = function () {
                activeXhr = null;
                reject(new Error("upload-aborted"));
            };

            xhr.send(formData);
        });
    }

    function pollStatus(jobId) {
        abortController = new AbortController();
        fetch(STATUS_URL + jobId, { signal: abortController.signal })
            .then(function (res) {
                if (!res.ok) throw new Error("status-failed");
                return res.json();
            })
            .then(function (body) {
                var data = body.data;
                var status = data.job_status;

                if (status === "DONE") {
                    current.transcriptUrl = data.transcript_presigned_url || "";
                    doneFilename.textContent = current.fileName;
                    doneMeta.textContent = current.sizeLabel + " · " + current.durationLabel;
                    linkEl.textContent = current.transcriptUrl;
                    copyBtn.textContent = "Copy link";
                    showState("done");
                    setActiveStep("done");
                    setFootnote(FOOTNOTES.done);
                    return;
                }

                if (status === "FAILED") {
                    showError("Transcription failed. Please try again.");
                    return;
                }

                if (status === "WAITING_FOR_UPLOAD") {
                    setStage("upload", "Uploading…");
                } else if (status === "CHUNKING") {
                    setStage("process", "Chunking…");
                } else if (status === "TRANSCRIBING") {
                    setStage("transcribe", "Transcribing…");
                } else {
                    statusLine.textContent = status;
                }
                pollTimer = setTimeout(function () { pollStatus(jobId); }, POLL_INTERVAL_MS);
            })
            .catch(function (err) {
                if (err && err.name === "AbortError") return;
                showError("Lost connection while checking transcription status. Please try again.");
            });
    }

    function resetFlow() {
        clearPollTimer();
        setProgressIndeterminate();
        if (objectUrl) {
            URL.revokeObjectURL(objectUrl);
            objectUrl = null;
        }
        current = { fileName: "", sizeLabel: "", durationLabel: "—", transcriptUrl: "" };
        dropzone.classList.remove("is-drag-over");
        stepsBarFailed.hidden = true;
        stepsBar.hidden = false;
        showState("idle");
        setActiveStep(null);
        setFootnote(FOOTNOTES.idle);
    }

    function copyLink() {
        if (current.transcriptUrl && navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(current.transcriptUrl).catch(function () {});
        }
        copyBtn.textContent = "Copied";
        clearTimeout(copiedTimer);
        copiedTimer = setTimeout(function () {
            copyBtn.textContent = "Copy link";
        }, 1500);
    }

    function slugify(fileName) {
        var name = fileName || "audio";
        var dot = name.lastIndexOf(".");
        var base = dot > 0 ? name.slice(0, dot) : name;
        var slug = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
        return slug || "audio";
    }

    function downloadTranscript() {
        if (!current.transcriptUrl) return;
        var originalLabel = downloadBtn.textContent;
        downloadBtn.textContent = "Downloading…";
        fetch(current.transcriptUrl)
            .then(function (res) {
                if (!res.ok) throw new Error("download-failed");
                return res.blob();
            })
            .then(function (blob) {
                var url = URL.createObjectURL(blob);
                var a = document.createElement("a");
                a.href = url;
                a.download = slugify(current.fileName) + ".txt";
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
            })
            .catch(function (err) {
                console.error("Transcript download failed, falling back to opening the link:", err);
                window.open(current.transcriptUrl, "_blank", "noopener");
            })
            .then(function () {
                downloadBtn.textContent = originalLabel;
            });
    }

    setFootnote(FOOTNOTES.idle);

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
    downloadBtn.addEventListener("click", downloadTranscript);
    resetLink.addEventListener("click", function (e) {
        e.preventDefault();
        resetFlow();
    });
    errorResetLink.addEventListener("click", function (e) {
        e.preventDefault();
        resetFlow();
    });

    window.addEventListener("beforeunload", function () {
        clearPollTimer();
        clearTimeout(copiedTimer);
        abortInFlight();
        if (objectUrl) URL.revokeObjectURL(objectUrl);
    });
})();
