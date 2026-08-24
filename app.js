import {
    getDocument,
    GlobalWorkerOptions
} from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.149/pdf.min.mjs";


GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.149/pdf.worker.min.mjs";


const PDF_URL = "./menu.pdf";

const pagesContainer =
    document.getElementById("pages");


/*
 * Zoom configuration
 */

const MIN_ZOOM = 1;

const MAX_ZOOM = 4;

const DOUBLE_TAP_ZOOM = 2;


/*
 * Load PDF
 */

async function loadPDF() {

    try {

        const pdf =
            await getDocument(PDF_URL).promise;


        for (
            let pageNumber = 1;
            pageNumber <= pdf.numPages;
            pageNumber++
        ) {

            await renderPage(
                pdf,
                pageNumber
            );
        }


    } catch (error) {

        console.error(
            "Unable to load PDF:",
            error
        );

        pagesContainer.innerHTML = `
            <div style="
                padding: 40px;
                text-align: center;
                font-family: Arial;
            ">
                Unable to load menu.
            </div>
        `;
    }
}


/*
 * Render one PDF page
 */

async function renderPage(
    pdf,
    pageNumber
) {

    const page =
        await pdf.getPage(pageNumber);


    /*
     * Render at 2x resolution.
     *
     * This gives better quality when
     * the user zooms into the page.
     */

    const viewport =
        page.getViewport({
            scale: 2
        });


    /*
     * Wrapper
     */

    const wrapper =
        document.createElement("div");

    wrapper.className =
        "page-wrapper";


    /*
     * Canvas
     */

    const canvas =
        document.createElement("canvas");

    canvas.className =
        "page";


    canvas.width =
        viewport.width;

    canvas.height =
        viewport.height;


    const context =
        canvas.getContext("2d");


    await page.render({

        canvasContext:
            context,

        viewport:
            viewport

    }).promise;


    wrapper.appendChild(canvas);

    pagesContainer.appendChild(wrapper);


    /*
     * Enable touch gestures
     */

    enableZoom(wrapper);
}


/*
 * Touch zoom / pan
 */

function enableZoom(element) {

    let scale = 1;

    let startScale = 1;

    let startDistance = 0;


    /*
     * Position of the zoomed page
     */

    let translateX = 0;

    let translateY = 0;


    /*
     * Starting finger position
     */

    let startX = 0;

    let startY = 0;

    let startTranslateX = 0;

    let startTranslateY = 0;


    /*
     * Double tap detection
     */

    let lastTapTime = 0;

    let lastTapX = 0;

    let lastTapY = 0;

    let lastTouchEndTime = 0;


    /*
     * Prevent browser gestures
     */

    element.addEventListener(
        "touchstart",
        event => {

            /*
             * Two fingers = pinch
             */

            if (event.touches.length === 2) {

                event.preventDefault();


                startDistance =
                    getDistance(
                        event.touches[0],
                        event.touches[1]
                    );


                startScale =
                    scale;


                return;
            }


            /*
             * One finger
             */

            if (event.touches.length === 1) {

                const touch =
                    event.touches[0];


                const now =
                    Date.now();


                /*
                 * Double tap
                 */

                if (
                    now - lastTapTime < 300
                ) {

                    const distance =
                        Math.sqrt(
                            Math.pow(
                                touch.clientX -
                                lastTapX,
                                2
                            ) +
                            Math.pow(
                                touch.clientY -
                                lastTapY,
                                2
                            )
                        );


                    if (distance < 40) {

                        event.preventDefault();


                        if (scale === 1) {

                            scale =
                                DOUBLE_TAP_ZOOM;

                            zoomToPoint(
                                element,
                                DOUBLE_TAP_ZOOM,
                                touch.clientX,
                                touch.clientY
                            );

                        } else {

                            resetZoom(element);

                            scale = 1;

                            translateX = 0;
                            translateY = 0;
                        }


                        lastTapTime = 0;

                        return;
                    }
                }


                lastTapTime =
                    now;


                lastTapX =
                    touch.clientX;

                lastTapY =
                    touch.clientY;


                /*
                 * Start dragging when zoomed
                 */

                if (scale > 1) {

                    startX =
                        touch.clientX;

                    startY =
                        touch.clientY;


                    startTranslateX =
                        translateX;

                    startTranslateY =
                        translateY;
                }
            }

        },
        {
            passive: false
        }
    );


    /*
     * Touch move
     */

    element.addEventListener(
        "touchmove",
        event => {

            /*
             * PINCH
             */

            if (event.touches.length === 2) {

                event.preventDefault();


                const distance =
                    getDistance(
                        event.touches[0],
                        event.touches[1]
                    );


                if (startDistance === 0) {
                    return;
                }


                const scaleChange =
                    distance /
                    startDistance;


                let newScale =
                    startScale *
                    scaleChange;


                newScale =
                    Math.max(
                        MIN_ZOOM,
                        Math.min(
                            MAX_ZOOM,
                            newScale
                        )
                    );


                /*
                 * Center of fingers
                 */

                const centerX =
                    (
                        event.touches[0].clientX +
                        event.touches[1].clientX
                    ) / 2;


                const centerY =
                    (
                        event.touches[0].clientY +
                        event.touches[1].clientY
                    ) / 2;


                /*
                 * Zoom around finger center
                 */

                zoomToPoint(
                    element,
                    newScale,
                    centerX,
                    centerY
                );


                scale =
                    newScale;


                return;
            }


            /*
             * DRAG / PAN
             */

            if (
                event.touches.length === 1 &&
                scale > 1
            ) {

                event.preventDefault();


                const touch =
                    event.touches[0];


                const deltaX =
                    touch.clientX -
                    startX;


                const deltaY =
                    touch.clientY -
                    startY;


                translateX =
                    startTranslateX +
                    deltaX;


                translateY =
                    startTranslateY +
                    deltaY;


                applyTransform(
                    element,
                    scale,
                    translateX,
                    translateY
                );
            }

        },
        {
            passive: false
        }
    );


    /*
     * Touch end
     */

    element.addEventListener(
        "touchend",
        event => {

            lastTouchEndTime =
                Date.now();

            if (
                event.touches.length < 2
            ) {

                startDistance = 0;
            }


            /*
             * Reset to normal if
             * zoom becomes very small
             */

            if (scale <= 1.01) {

                scale = 1;

                translateX = 0;
                translateY = 0;

                resetZoom(element);
            }
        }
    );


    /*
     * Mouse wheel zoom for desktop
     */

    element.addEventListener(
        "wheel",
        event => {

            /*
             * Ctrl + wheel
             * behaves like zoom.
             */

            if (!event.ctrlKey) {
                return;
            }


            event.preventDefault();


            let newScale =
                scale +
                (event.deltaY < 0
                    ? 0.15
                    : -0.15);


            newScale =
                Math.max(
                    MIN_ZOOM,
                    Math.min(
                        MAX_ZOOM,
                        newScale
                    )
                );


            zoomToPoint(
                element,
                newScale,
                event.clientX,
                event.clientY
            );


            scale =
                newScale;

        },
        {
            passive: false
        }
    );


    /*
     * Desktop double click
     */

    element.addEventListener(
        "dblclick",
        event => {

            event.preventDefault();

            if (Date.now() - lastTouchEndTime < 500) {
                return;
            }


            if (scale === 1) {

                scale =
                    DOUBLE_TAP_ZOOM;


                zoomToPoint(
                    element,
                    scale,
                    event.clientX,
                    event.clientY
                );

            } else {

                scale = 1;

                translateX = 0;
                translateY = 0;

                resetZoom(element);
            }
        }
    );


    /*
     * Apply initial transform
     */

    applyTransform(
        element,
        scale,
        translateX,
        translateY
    );


    /*
     * Calculate distance between two fingers
     */

    function getDistance(
        touch1,
        touch2
    ) {

        const dx =
            touch2.clientX -
            touch1.clientX;


        const dy =
            touch2.clientY -
            touch1.clientY;


        return Math.sqrt(
            dx * dx +
            dy * dy
        );
    }


    /*
     * Apply CSS transform
     */

    function applyTransform(
        element,
        scale,
        x,
        y
    ) {

        element.style.transform =
            `translate3d(${x}px, ${y}px, 0)
             scale(${scale})`;

        element.style.zIndex =
            scale > 1
                ? "10"
                : "1";
    }


    /*
     * Zoom around a specific point
     */

    function zoomToPoint(
        element,
        newScale,
        clientX,
        clientY
    ) {

        const rect =
            element.getBoundingClientRect();


        const centerX =
            rect.left +
            rect.width / 2;


        const centerY =
            rect.top +
            rect.height / 2;


        /*
         * Position relative to
         * current transformed center.
         */

        const offsetX =
            clientX -
            centerX;


        const offsetY =
            clientY -
            centerY;


        const scaleRatio =
            newScale / scale;


        translateX =
            offsetX -
            (offsetX - translateX) *
            scaleRatio;


        translateY =
            offsetY -
            (offsetY - translateY) *
            scaleRatio;


        applyTransform(
            element,
            newScale,
            translateX,
            translateY
        );
    }


    /*
     * Reset zoom
     */

    function resetZoom(element) {

        element.style.transition =
            "transform 200ms ease";


        element.style.transform =
            "translate3d(0, 0, 0) scale(1)";


        element.style.zIndex =
            "1";


        setTimeout(() => {

            element.style.transition =
                "";

        }, 200);
    }
}


/*
 * Start
 */

loadPDF();