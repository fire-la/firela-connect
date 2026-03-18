import React, { useContext, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { StatusContext } from '../../context/Status';

const SetupCheck = ({ children }) => {
  // Setup check disabled for user-ui - redirect logic commented out
  // const [statusState] = useContext(StatusContext);
  // const location = useLocation();
  //
  // useEffect(() => {
  //   if (
  //     statusState?.status?.setup === false &&
  //     location.pathname !== '/setup'
  //   ) {
  //     window.location.href = '/setup';
  //   }
  // }, [statusState?.status?.setup, location.pathname]);

  return children;
};

export default SetupCheck;
