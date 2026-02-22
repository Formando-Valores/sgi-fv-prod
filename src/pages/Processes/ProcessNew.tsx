/**
 * SGI FV - Process New Page
 * Form to create a new process (redirects to list with modal)
 */

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * This page redirects to /processos which has the create modal.
 * Kept for route compatibility.
 */
const ProcessNew: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to process list - the modal is there
    navigate('/processos', { replace: true });
  }, [navigate]);

  return null;
};

export default ProcessNew;
