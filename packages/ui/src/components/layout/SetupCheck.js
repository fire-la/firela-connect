import React from 'react';

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
