function AppFooter() {
  return (
    <footer className="app-footer">
      <div className="footer-divider" aria-hidden="true"></div>
      <div className="footer-group footer-about">
        <a
          href="https://www.linkedin.com/in/jeremy-mason-wood/"
          target="_blank"
          rel="noreferrer"
        >
          About me
        </a>
      </div>
      <div className="footer-group email-container footer-email">
        <a href="mailto:jeremy.mason.wood@gmail.com">
          <i className="fa-regular fa-envelope"></i>
          <span>jeremy.mason.wood@gmail.com</span>
        </a>
      </div>
      <div className="footer-group footer-spacer"></div>
      <div className="footer-group footer-spacer"></div>
      <div className="footer-group footer-social">
        <a
          href="https://www.linkedin.com/in/jeremy-mason-wood/"
          target="_blank"
          rel="noreferrer"
        >
          <i className="fa-brands fa-linkedin"></i>
        </a>
        <a href="https://github.com/jeremymwood" target="_blank" rel="noreferrer">
          <i className="fa-brands fa-square-github"></i>
        </a>
      </div>
    </footer>
  );
}

export default AppFooter;
