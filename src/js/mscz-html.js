// msczHtml.js

const numberToTime = (number) => {
    const hours = Math.floor(number / 3600);
    const minutes = Math.floor((number % 3600) / 60);
    const seconds = Math.floor(number % 60);
    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

const bisect_right = (arr, x, lo = 0, hi = arr.length, key = (x) => x) => {
    while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (key(arr[mid]) <= x) {
            lo = mid + 1;
        } else {
            hi = mid;
        }
    }
    return lo;
}

let SpessaSynth_url_prefix = "https://cdn.jsdelivr.net/npm/spessasynth_lib@3.25.23/"

let load_idx = 0;
let sf3;
let global_vars = new Object();

let msczHtml = {
    ready: null,
    isReady: false,
    initializing: false,
    init: async () => {
        if (msczHtml.initializing || msczHtml.isReady) {
            return;
        }
        msczHtml.initializing = true;
        const [WORKLET_URL_ABSOLUTE, Sequencer, Synthetizer] = await Promise.all([
            import(SpessaSynth_url_prefix + "synthetizer/worklet_wrapper/worklet_url.js").then(m => m.WORKLET_URL_ABSOLUTE),
            import(SpessaSynth_url_prefix + "sequencer/worklet_wrapper/sequencer.js").then(m => m.Sequencer),
            import(SpessaSynth_url_prefix + "synthetizer/worklet_wrapper/synthetizer.js").then(m => m.Synthetizer)
        ]);
        global_vars.Sequencer = Sequencer;
        global_vars.Synthetizer = Synthetizer;
        global_vars.WORKLET_URL_ABSOLUTE = WORKLET_URL_ABSOLUTE;

        sf3 = await fetch("https://mscz-html.carlgao4.workers.dev/GeneralUserGS.sf3").then(response => response.arrayBuffer());

        msczHtml.isReady = true;
        console.log("msczHtml loaded successfully");

        let elements = document.querySelectorAll('[mscz-html]');
        for (const element of elements) {
            const jsonFile = element.getAttribute('mscz-html');
            const config = JSON.parse(element.getAttribute('mscz-config')) || null;
            msczHtml.displayMsczJson(element, jsonFile, config).catch(error => {
                console.error(`Error loading msczHtml: ${error.message}`);
            });
        }

        if (typeof msczHtml.ready === "function") {
            msczHtml.ready();
        }
    },
    /**
     * Renders and displays the specified JSON data into an HTML element.
     *
     * @async
     * @function displayMsczJson
     * @param {string|HTMLElement} cssSelector - A CSS selector string to select the target HTML element, or the target HTMLElement itself.
     * @param {string|Object} jsonFile - The URL string of the JSON file, or the JSON data object directly.
     * @param {Object|null} config - Configuration object for customizing rendering behavior (optional).
     * Available options:
     * - `autoScroll`: A boolean indicating whether to enable auto-scrolling (default: true).
     * - `audio`: An array, all items in the array should be objects with `src`, `name` and optional `measures` attribute. `measures` should be an array of objects with `id` and `time` attributes. `id` starts from 0 and `time` is in seconds.
     * 
     * @throws {Error} Throws an error if `cssSelector` is neither a string nor an HTMLElement.
     * @throws {Error} Throws an error if the specified HTML element cannot be found.
     * @throws {Error} Throws an error if `jsonFile` is neither a string nor an object.
     * @throws {Error} Throws an error if the JSON data is missing required keys (e.g., `svgs`, `mposXML`, `metadata`, `midi`).
     * 
     * @example
     * // Using a CSS selector to load JSON data
     * msczHtml.displayMsczJson('#my-element', 'path/to/data.json', { autoScroll: true });
     * 
     * @example
     * // Using an HTMLElement and directly passing JSON data
     * const element = document.getElementById('my-element');
     * const jsonData = { svgs: [...], mposXML: "...", metadata: {...}, midi: "..." };
     * msczHtml.displayMsczJson(element, jsonData, { autoScroll: false });
     */
    displayMsczJson: async (cssSelector, jsonFile, config) => {
        let currentId = load_idx++;
        let element;

        if (typeof cssSelector === 'object' && cssSelector instanceof HTMLElement) {
            element = cssSelector;
        } else if (typeof cssSelector === 'string') {
            element = document.querySelector(cssSelector);
        } else {
            throw new Error(`Invalid selector type: ${typeof cssSelector}`);
        }

        if (!element) {
            throw new Error(`Element with selector ${cssSelector} not found`);
        }

        let data;
        if (typeof jsonFile === "string") {
            const response = await fetch(jsonFile);
            if (!response.ok) {
                throw new Error(`Failed to fetch JSON file: ${response.statusText}`);
            }
            data = await response.json();
        } else if (typeof jsonFile === "object") {
            data = jsonFile;
        } else {
            throw new Error(`Invalid JSON file type: ${typeof jsonFile}.`);
        }

        // Validate the data structure
        if (!data || !data.svgs || !data.mposXML || !data.metadata || !data.midi) {
            throw new Error(`Missing expected keys in JSON data`);
        }

        // Construct the HTML string
        let html = `<div class="mscz-player-controls">`;
        html += `<div class="mscz-player-controls-buttons">`;
        html += `<button class="mscz-button mscz-play-button"></button>`;
        html += `<button class="mscz-button mscz-pause-button"></button>`;
        html += `<button class="mscz-button mscz-back-button"></button>`;
        html += `</div>`;
        html += `<div class="mscz-player-controls-select">`;
        html += `<select class="mscz-track-select">`;
        html += `<option value="0">MIDI</option>`;
        html += `</select>`;
        html += `</div>`;
        html += `<div class="mscz-player-scroll">`;
        html += `<input type="checkbox" ${((config && config.autoScroll !== undefined && config.autoScroll) || true) ? "checked" : ""}>Auto Scroll</button>`;
        html += `</div>`;
        html += `<div class="mscz-player-controls-time">${numberToTime(0)} / ${numberToTime(data.metadata.duration)}</div>`;
        html += `<div class="mscz-player-controls-seek">`;
        html += `<input type="range" class="mscz-seek-bar" min="0" max="${data.metadata.duration * 10}">`;
        html += `</div></div>`;
        element.innerHTML = html;
        element.querySelector("input[type=range]").value = 0;

        // Load SVG images
        const picElements = document.createElement('div');
        picElements.classList.add('mscz-images-container');
        element.appendChild(picElements);
        const svg_viewPorts = [];
        for (const svg of data.svgs) {
            const singleImgContainer = document.createElement('div');
            singleImgContainer.classList.add('mscz-image-container');
            const img = document.createElement('img');
            img.src = `data:image/svg+xml;base64,${svg}`;
            img.classList.add('mscz-svg-image');
            singleImgContainer.appendChild(img);
            picElements.appendChild(singleImgContainer);
            const parsedSvg = new DOMParser().parseFromString(atob(svg), "image/svg+xml");
            svg_viewPorts.push(parsedSvg.querySelector("svg").viewBox.baseVal);
        }

        // Load mposXML
        const mposXML = atob(data.mposXML);
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(mposXML, "text/xml");
        for (const measure of xmlDoc.getElementsByTagName("element")) {
            const measure_element = document.createElement('div');
            const measure_page = parseInt(measure.getAttribute("page"));
            const measure_x = parseFloat(measure.getAttribute("x")) / 11;
            const measure_y = parseFloat(measure.getAttribute("y")) / 11;
            const measure_width = parseFloat(measure.getAttribute("sx")) / 11;
            const measure_height = parseFloat(measure.getAttribute("sy")) / 11;
            measure_element.classList.add('mscz-measure-overlay');
            measure_element.style.left = `calc(${measure_x / svg_viewPorts[measure_page].width} * calc(100% - var(--mscz-page-padding) * 2) + var(--mscz-page-padding))`;
            measure_element.style.top = `calc(${measure_y / svg_viewPorts[measure_page].height} * calc(100% - var(--mscz-page-padding)) + var(--mscz-page-padding))`;
            measure_element.style.width = `calc(${measure_width / svg_viewPorts[measure_page].width} * calc(100% - var(--mscz-page-padding) * 2))`;
            measure_element.style.height = `calc(${measure_height / svg_viewPorts[measure_page].height} * calc(100% - var(--mscz-page-padding)))`;
            measure_element.id = `mscz-measure-${currentId}-${measure.getAttribute("id")}`;
            picElements.childNodes[measure_page].appendChild(measure_element);
        }
        let times = [[]];
        for (const measure of xmlDoc.getElementsByTagName("event")) {
            times[0].push({ id: parseInt(measure.getAttribute("elid")), time: parseFloat(measure.getAttribute("position")) / 1000 });
            var measure_element = element.querySelector(`#mscz-measure-${currentId}-${measure.getAttribute("elid")}`);
            if (measure_element && !measure_element.hasAttribute("time")) {
                measure_element.setAttribute("time", parseFloat(measure.getAttribute("position")) / 1000);
            }
        }
        times[0].sort((a, b) => a.time - b.time);

        let midi_player;
        let audio_players = [];
        if (config && config.audio) {
            for (let i = 0; i < config.audio.length; i++) {
                const audio = config.audio[i];
                if (audio.src && audio.name) {
                    let audio_player = new Audio();
                    audio_player.crossOrigin = "*";
                    audio_player.loop = true;
                    // We don't need to set the src here to avoid preloading the audio
                    if (audio.measures) {
                        times.push([]);
                        for (let measure of audio.measures) {
                            times[i + 1].push({ id: measure.id, time: measure.time });
                        }
                    }
                    else {
                        times.push(times[0]);
                    }
                    times[i + 1].sort((a, b) => a.time - b.time);
                    element.querySelector(".mscz-track-select").innerHTML += `<option value="${i + 1}">${audio.name}</option>`;
                    audio_players.push(audio_player);
                }
            }
        }

        const midiData = atob(data.midi);
        const midi_byteNumbers = new Array(midiData.length);
        for (let i = 0; i < midiData.length; i++) {
            midi_byteNumbers[i] = midiData.charCodeAt(i);
        }
        const midi_byteArray = new Uint8Array(midi_byteNumbers);
        const midi_arrayBuffer = midi_byteArray.buffer;
        element.querySelector(".mscz-play-button").addEventListener("click", async () => {
            if (!midi_player) {
                element.querySelector("select").value = "0";
                let context = new AudioContext();
                await context.audioWorklet.addModule(new URL(SpessaSynth_url_prefix + global_vars.WORKLET_URL_ABSOLUTE));
                let synth = new global_vars.Synthetizer(context.destination, sf3);
                midi_player = new global_vars.Sequencer([{
                    binary: midi_arrayBuffer,
                    altName: "midi",
                }], synth);
                audio_players.unshift(midi_player);
                const slider = element.querySelector("input[type=range]");
                const setCurrentTime = (time) => {
                    let track_id = parseInt(element.querySelector("select").value);
                    element.querySelector(".mscz-player-controls-time").innerText = `${numberToTime(time)} / ${numberToTime(audio_players[track_id].duration)}`;
                    // Only adjust the slider if it is not active
                    if (!slider.matches(':active')) {
                        slider.value = time * 10;
                        slider.setAttribute("max", audio_players[track_id].duration * 10);
                    }
                    let times_current = times[track_id];
                    let idx = bisect_right(times_current, time, 0, times_current.length, (x) => x.time) - 1;
                    if (idx >= 0) {
                        let measure_element = element.querySelector(`#mscz-measure-${currentId}-${times_current[idx].id}`);
                        if (measure_element) {
                            if (!measure_element.classList.contains("mscz-measure-overlay-current")) {
                                let measure_elements = element.querySelectorAll(".mscz-measure-overlay-current");
                                for (let i = 0; i < measure_elements.length; i++) {
                                    measure_elements[i].classList.remove("mscz-measure-overlay-current");
                                }
                                measure_element.classList.add("mscz-measure-overlay-current");
                                if (element.querySelector(".mscz-player-scroll input").checked) {
                                    measure_element.scrollIntoView({ behavior: "smooth", block: "center" });
                                }
                            }
                        }
                    }
                }
                const adjustCurrentTime = (time) => {
                    let track_id = parseInt(element.querySelector("select").value);
                    audio_players[track_id].currentTime = time;
                }
                slider.onchange = () => {
                    adjustCurrentTime(slider.value / 10);
                }
                for (let i of element.querySelectorAll(".mscz-measure-overlay")) {
                    i.onclick = () => {
                        adjustCurrentTime(i.getAttribute("time"));
                    }
                }
                element.querySelector(".mscz-track-select").onchange = () => {
                    let track_id = parseInt(element.querySelector("select").value);
                    for (let i = 0; i < audio_players.length; i++) {
                        audio_players[i].pause();
                    }
                    if (track_id > 0) {
                        audio_players[track_id].src = config.audio[track_id - 1].src;
                    }
                    for (let i of element.querySelectorAll(".mscz-measure-overlay")) {
                        i.removeAttribute("time");
                        i.classList.remove("mscz-measure-overlay-current");
                    }
                    for (let i of times[track_id]) {
                        var measure_element = element.querySelector(`#mscz-measure-${currentId}-${i.id}`);
                        if (measure_element && !measure_element.hasAttribute("time")) {
                            measure_element.setAttribute("time", i.time);
                        }
                    }
                }
                setInterval(() => {
                    let track_id = parseInt(element.querySelector("select").value);
                    setCurrentTime(audio_players[track_id].currentTime);
                }, 100);

            }
            let track_id = parseInt(element.querySelector("select").value);
            audio_players[track_id].play();
        });
        element.querySelector(".mscz-pause-button").addEventListener("click", () => {
            if (!midi_player) { return };
            for (let i = 0; i < audio_players.length; i++) {
                audio_players[i].pause();
            }
        });
        element.querySelector(".mscz-back-button").addEventListener("click", () => {
            if (!midi_player) { return };
            for (let i = 0; i < audio_players.length; i++) {
                audio_players[i].currentTime = 0;
                audio_players[i].pause();
            }
        });
    }
};

msczHtml.init();

if (typeof window !== "undefined") {
    window.msczHtml = msczHtml;
}

export default msczHtml;
