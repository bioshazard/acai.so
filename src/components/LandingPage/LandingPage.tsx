import React, { useState, useEffect, useRef } from 'react';
import screenshot from '../../assets/app-screenshot.png';
import './LandingPage.css'; // import the CSS file

const tagLines = [
  'ACAI is an AI powered super tool',
  'ACAI compliments your workflow',
  'ACAI expands your capabilities',
  'ACAI is your personal assistant',
  'ACAI empowers you to do more',
  // Add more taglines as needed
];

interface LandingPageProps {
  singleTagline?: boolean;
}

const LandingPage: React.FC<LandingPageProps> = ({ singleTagline = false }) => {
  const [tagLineIndex, setTagLineIndex] = useState(
    Math.floor(Math.random() * tagLines.length),
  );
  const [wordIndex, setWordIndex] = useState(0);
  const [isTaglineComplete, setIsTaglineComplete] = useState(false);

  const timers = useRef<NodeJS.Timeout[]>([]);

  useEffect(() => {
    if (singleTagline && isTaglineComplete) return; // If singleTagline is true and the tagline is complete, stop the effect

    timers.current.push(
      setTimeout(() => {
        setWordIndex((prevIndex) => prevIndex + 1);
      }, 500),
    );

    if (wordIndex === tagLines[tagLineIndex].split(' ').length) {
      setIsTaglineComplete(true);
      timers.current.forEach(clearTimeout);
      timers.current = [];
      if (!singleTagline) {
        // Only update the tagline if singleTagline is false
        timers.current.push(
          setTimeout(() => {
            setTagLineIndex((prevIndex) => (prevIndex + 1) % tagLines.length);
            setWordIndex(0);
            setIsTaglineComplete(false);
          }, 5000),
        );
      }
    }

    return () => timers.current.forEach(clearTimeout);
  }, [wordIndex, tagLineIndex, singleTagline, isTaglineComplete]);

  return (
    <div className="relative bg-gradient-to-b from-darker to-acai-darker h-screen w-screen m-0 flex flex-col items-center justify-center text-white">
      <h1 className="text-5xl mb-8 z-10">acai.so</h1>
      <div className="relative bg-darker rounded-xl overflow-hidden w-3/4 h-3/4 z-10 group">
        <img
          src={screenshot}
          alt="App Screenshot"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center transition-opacity duration-500 group-hover:opacity-0">
          <p className="text-4xl text-white">
            {tagLines[tagLineIndex].split(' ').map((word, index) => (
              <span
                key={index}
                className={index < wordIndex ? 'fade-in' : 'fade-out'}
                style={{
                  visibility:
                    index < wordIndex || isTaglineComplete
                      ? 'visible'
                      : 'hidden',
                }}
              >
                {word}{' '}
              </span>
            ))}
          </p>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
