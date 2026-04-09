import React from 'react';

type CardProps = React.HTMLAttributes<HTMLDivElement>;

const Card: React.FC<CardProps> = ({ className = '', ...props }) => (
  <div
    className={`bg-white rounded-xl shadow-[0_16px_34px_rgba(15,23,42,0.08)] p-5 border border-gray-100 ${className}`.trim()}
    {...props}
  />
);

export default Card;
