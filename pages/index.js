import { useEffect, useRef, useState } from 'react';
import service from '../services/service';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHandPaper } from '@fortawesome/free-solid-svg-icons';

const maxVideoSize = 224;
const LETTERS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O',
  'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '_NOTHING', '_SPACE'
];
const THRESHOLD = 5;
const THRESHOLDS = {
  S: 3, E: 5, A: 5, N: 6, R: 5
};

export default function Page() {
  const videoElement = useRef(null);
  const canvasEl = useRef(null);
  const outputCanvasEl = useRef(null);
  const predictedLetterRef = useRef(''); // Use useRef to track predicted letter
  const [letter, setLetter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fps, setFps] = useState(0);
  const [words, setWords] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [pendingLetter, setPendingLetter] = useState('');

  async function processImage() {
    if (videoElement !== null && canvasEl !== null && videoElement.current !== null) {
      let frames = 0;
      let start = Date.now();
      let prevLetter = '';
      let count = 0;
      const predictionInterval = 200; // Time interval for each prediction in milliseconds (200ms = 5 FPS)

      while (true) {
        const ctx = canvasEl.current.getContext('2d');
        ctx.drawImage(videoElement.current, 0, 0, maxVideoSize, maxVideoSize);
        const image = ctx.getImageData(0, 0, maxVideoSize, maxVideoSize);

        const processedImage = await service.imageProcessing(image);
        const ctxOutput = outputCanvasEl.current.getContext('2d');
        ctxOutput.putImageData(processedImage.data.payload, 0, 0);

        const prediction = await service.predict(processedImage.data.payload);
        const predictedLetterIndex = prediction.data.payload;
        const predictedLetter = LETTERS[predictedLetterIndex];

        predictedLetterRef.current = predictedLetter; // Update ref without triggering re-render
        setLetter(predictedLetter); // Optionally update state for displaying letter in UI

        if (predictedLetter !== prevLetter) {
          if (!THRESHOLDS[prevLetter] ? count > THRESHOLD : count > THRESHOLDS[prevLetter]) {
            if (!isConfirming) {
              setPendingLetter(predictedLetter); // Set the letter to be confirmed
              setIsConfirming(true); // Show the confirmation prompt
            }
            count = 0;
          }
        } else {
          count++;
        }
        prevLetter = predictedLetter;

        frames++;
        if (frames === 10) {
          setFps(10 / ((Date.now() - start) / 1000));
          frames = 0;
          start = Date.now();
        }

        // Add a delay before the next frame prediction
        await new Promise(resolve => setTimeout(resolve, 200));  // Delay in milliseconds
      }
    }
  }

  useEffect(() => {
    async function initCamera() {
      videoElement.current.width = maxVideoSize;
      videoElement.current.height = maxVideoSize;

      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: 'environment', width: maxVideoSize, height: maxVideoSize },
        });
        videoElement.current.srcObject = stream;

        return new Promise((resolve) => {
          videoElement.current.onloadedmetadata = () => {
            resolve(videoElement.current);
          };
        });
      }

      const errorMessage = 'This browser does not support video capture, or this device does not have a camera';
      alert(errorMessage);
      return Promise.reject(errorMessage);
    }

    async function load() {
      const videoLoaded = await initCamera();
      await service.load();
      videoLoaded.play();
      setTimeout(processImage, 0);
      setLoading(false);
      return videoLoaded;
    }

    load();
  }, []);

  const handleConfirm = () => {
    if (letter !== '_NOTHING') {
      setWords((prevWords) => prevWords + letter);  // Add the letter to words
    }
    setIsConfirming(false);  // Reset confirmation state
  };

  const handleReject = () => {
    setIsConfirming(false);  // Reject the letter and reset confirmation state
  };

  return (
    <div style={{ marginTop: '2em' }}>
      <h1 className="text-center text-heading" style={{ marginBottom: '0.5em' }}>
        <FontAwesomeIcon icon={faHandPaper} /> 
      </h1>

      {loading && (
        <div className="row justify-content-center">
          <div className="col text-center">
            <div className="spinner-border" style={{ width: '8em', height: '8em', marginBottom: '2em' }} role="status"></div>
          </div>
        </div>
      )}

      <div style={{ display: loading ? 'none' : 'block' }}>
        <div className="row justify-content-center">
          <div className="col-xs-12 text-center">
            <video className="video" playsInline ref={videoElement} />
          </div>
          <canvas style={{ display: 'none' }} ref={canvasEl} width={maxVideoSize} height={maxVideoSize}></canvas>
          <canvas className="col-xs-12" style={{ display: 'none' }} ref={outputCanvasEl} width={maxVideoSize} height={maxVideoSize}></canvas>
        </div>

        <div className="justify-content-center text-center w-[500px]" style={{ marginTop: '2em' }}>
          <div className="col-xs-12">
            <h5 className="text-letter">Predicted Letter:</h5>
            <h4 className="text-letter" style={{ borderRadius: 10, border: '2px solid #FFFFFF', padding: '0.5em' }}>
              {letter}
            </h4>
          </div>

          {isConfirming && (
            <div className="confirmation-modal">
              <h5>Do you want to add the letter "{letter}" to the word?</h5>
              <button onClick={handleConfirm}>Confirm</button>
              <button onClick={handleReject}>Reject</button>
            </div>
          )}
        </div>

        <div className="row justify-content-center text-center" style={{ marginTop: '2em' }}>
          <div className="col-xs-12">
            <h3 className="text-words">Predicted Words:</h3>
            <h2 className="text-words" style={{ borderRadius: 10, border: '2px solid #FFFFFF', padding: '1em' }}>
              {words}
            </h2>
            <button className="Reset-button" onClick={() => setWords('')}>Reset</button>
            <p className="text-fps">FPS: {fps.toFixed(3)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
