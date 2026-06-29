// Demo code for ScoreCircle.jsx
import React from 'react';

const ScoreCircle = ({ score = 75 }) => (
  <div className="score-circle">
    <span>{score}</span>
  </div>
);

export default ScoreCircle;
