import React from 'react';

type CardProps = React.HTMLAttributes<HTMLDivElement>;

const Card: React.FC<CardProps> = ({ className = '', ...props }) => (
  <div
    className={`bg-white rounded-xl shadow-sm p-5 border border-gray-100 ${className}`.trim()}
    {...props}
  />
);

export default Card;
