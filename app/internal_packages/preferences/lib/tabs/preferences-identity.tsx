import React from 'react';
import {
  Actions,
  IdentityStore,
  localized,
  localizedReactFragment,
  IIdentity,
} from 'mailspring-exports';
import { OpenIdentityPageButton, RetinaImg } from 'mailspring-component-kit';
import { shell, ipcRenderer } from 'electron';

class RefreshButton extends React.Component<Record<string, unknown>, { refreshing: boolean }> {
  constructor(props) {
    super(props);
    this.state = { refreshing: false };
  }

  _mounted = false;

  componentDidMount() {
    this._mounted = true;
  }

  componentWillUnmount() {
    this._mounted = false;
  }

  _onClick = () => {
    this.setState({ refreshing: true });
    IdentityStore.fetchIdentity().then(() => {
      setTimeout(() => {
        if (this._mounted) {
          this.setState({ refreshing: false });
        }
      }, 400);
    });
  };

  render() {
    return (
      <div className={`refresh ${this.state.refreshing && 'spinning'}`} onClick={this._onClick}>
        <RetinaImg name="ic-refresh.png" mode={RetinaImg.Mode.ContentIsMask} />
      </div>
    );
  }
}

// Features the local identity server (local-identity-server/) serves without a quota. The
// app only talks to that server when `env` is `development`; on Mailspring's servers these
// stay Pro-limited, so they're only left out of the upgrade pitch in that mode.
const LOCALLY_SERVED_FEATURES = ['send-reminders', 'send-later', 'snooze'];

const isUsingLocalServer = () => AppEnv.config.get('env') === 'development';

function isOfferedAsPro(item: { feature?: string }) {
  return !(item.feature && isUsingLocalServer() && LOCALLY_SERVED_FEATURES.includes(item.feature));
}

const ProTourFeatures: {
  feature?: string;
  link: string;
  icon: string;
  title: string;
  text: string;
}[] = [
  {
    feature: 'send-reminders',
    link: 'https://getmailspring.com/docs/add-reminders-to-sent-messages',
    icon: `icon-composer-reminders.png`,
    title: localized(`Follow-up reminders`),
    text: localized(
      `Never forget to follow up! Mailspring reminds you if your messages haven't received replies.`
    ),
  },
  {
    link: 'https://getmailspring.com/docs/view-contact-and-company-profiles',
    icon: `toolbar-person-sidebar.png`,
    title: localized(`Rich contact profiles`),
    text: localized(
      `Write better emails with LinkedIn profiles, Twitter bios, message history, and more in the right sidebar.`
    ),
  },
  {
    link: 'https://getmailspring.com/docs/read-receipts-link-tracking-and-activity-reports',
    icon: `icon-composer-eye.png`,
    title: localized(`Read Receipts`),
    text: localized(
      `Get notified when each recipient opens your email to send timely follow-ups and reminders.`
    ),
  },
  {
    link: 'https://getmailspring.com/docs/reply-faster-with-email-templates',
    icon: `toolbar-templates.png`,
    title: localized(`Mail Templates`),
    text: localized(
      `Create templated messages and fill them quickly to reply to messages and automate your common workflows.`
    ),
  },
  {
    link: 'https://getmailspring.com/docs/read-receipts-link-tracking-and-activity-reports',
    icon: `icon-composer-linktracking.png`,
    title: localized(`Link tracking`),
    text: localized(
      `See when recipients click links in your emails so you can follow up with precision`
    ),
  },
  {
    feature: 'send-later',
    link: 'https://getmailspring.com/docs/schedule-messages-to-send-later',
    icon: `icon-composer-sendlater.png`,
    title: localized(`Send Later`),
    text: localized(
      `Schedule messages to send at the ideal time to maximize your email reply rate or automate drip emails.`
    ),
  },
  {
    link: 'https://getmailspring.com/docs/view-contact-and-company-profiles',
    icon: `icon-composer-reminders.png`,
    title: localized(`Company overviews`),
    text: localized(
      `See detailed information about companies you email, including their size, funding and timezone.`
    ),
  },
  {
    feature: 'snooze',
    link: 'https://getmailspring.com/docs/snooze-emails-to-handle-them-later',
    icon: `toolbar-snooze.png`,
    title: localized(`Snooze messages`),
    text: localized(
      `Schedule messages to re-appear later to keep your inbox clean and focus on immediate todos.`
    ),
  },
  {
    link: 'https://getmailspring.com/docs/read-receipts-link-tracking-and-activity-reports',
    icon: `icon-toolbar-activity.png`,
    title: localized(`Mailbox insights`),
    text: localized(
      `Use the Activity tab to get a birds-eye view of your mailbox: open and click rates, subject line effectiveness, and more.`
    ),
  },
  {
    link: 'https://getmailspring.com/docs/automatically-translate-incoming-email',
    icon: `pro-feature-translation.png`,
    title: localized(`Automatic Translation`),
    text: localized(
      `Instantly translate messages you receive into your preferred reading language.`
    ),
  },
];

class PreferencesIdentity extends React.Component<
  Record<string, unknown>,
  { identity: IIdentity | null }
> {
  static displayName = 'PreferencesIdentity';

  unsubscribe: () => void;

  constructor(props) {
    super(props);
    this.state = this._getStateFromStores();
  }

  componentDidMount() {
    this.unsubscribe = IdentityStore.listen(() => {
      this.setState(this._getStateFromStores());
    });
  }

  componentWillUnmount() {
    this.unsubscribe();
  }

  _getStateFromStores() {
    return {
      identity: IdentityStore.identity(),
    };
  }

  _onLinkIdentity = () => {
    ipcRenderer.send('command', 'application:add-identity');
  };

  _renderNoIdentity() {
    return (
      <>
        <div className="row padded">
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            <div className="basic-explanation" style={{ display: 'flex' }}>
              {localizedReactFragment(
                `You are not signed in to Mailspring. Link the app to a free Mailspring ID to use great free features like send later and snoozing, or upgrade to Mailspring Pro for unlimited message translation and more.`
              )}
              <div
                className="btn btn-emphasis"
                onClick={this._onLinkIdentity}
                style={{ verticalAlign: 'top', flexShrink: 0, marginLeft: 30 }}
              >
                <RetinaImg name="ic-upgrade.png" mode={RetinaImg.Mode.ContentIsMask} />{' '}
                {localized(`Setup Mailspring ID`)}
              </div>
            </div>
          </div>
        </div>
        <div className="row padded" style={{ paddingTop: 0 }}>
          <ExploreMailspringPro />
        </div>
      </>
    );
  }

  _renderBasicPlan() {
    const onLearnMore = () => shell.openExternal('https://getmailspring.com/pro');
    return (
      <div className="row padded">
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          <div className="basic-explanation">
            {isUsingLocalServer()
              ? localizedReactFragment(
                  `You are using %@, which is free! Snooze, send later and reminders are unlimited on your local server, and you can try other pro features like read receipts a few times a week.`,
                  <strong>{localized('Mailspring Basic')}</strong>
                )
              : localizedReactFragment(
                  `You are using %@, which is free! You can try pro features like snooze, send later, read receipts and reminders a few times a week.`,
                  <strong>{localized('Mailspring Basic')}</strong>
                )}
            {process.platform === 'linux' && (
              <span>
                {localizedReactFragment(
                  `Mailspring is independent %@ software, and subscription revenue allows us spend time maintaining and improving the product.`,
                  <a href="https://github.com/Foundry376/Mailspring/">{localized('open source')}</a>
                )}
              </span>
            )}
            <br />
            <br />
            {localizedReactFragment(
              `Upgrade to %@ to use all these great features permanently:`,
              <a onClick={onLearnMore}>{localized('Mailspring Pro')}</a>
            )}
            <ExploreMailspringSmall />
          </div>
          <div className="subscription-actions">
            <div className="pro-feature-ring">
              <RetinaImg name="pro-feature-ring.png" mode={RetinaImg.Mode.ContentPreserve} />
              <div className="price">$8</div>
              <div className="period">{localized('Monthly')}</div>
            </div>
            <OpenIdentityPageButton
              label={localized('Get Mailspring Pro')}
              path="/payment"
              source="Preferences Billing"
              campaign="Dashboard"
              img="ic-upgrade.png"
              isCTA={true}
            />
          </div>
        </div>
        <ExploreMailspringPro />
      </div>
    );
  }

  _renderPaidPlan(planName: string, effectivePlanName: string) {
    const planDisplayName = planName.replace('Annual', ` (${localized('annual')})`);

    const unpaidNote = effectivePlanName !== planName && (
      <p>
        {localized(
          `Note: Due to issues with your most recent payment, you've been temporarily downgraded to Mailspring %@. Click 'Billing' below to correct the issue.`,
          effectivePlanName
        )}
      </p>
    );
    return (
      <div className="row padded">
        <div>
          {localizedReactFragment(
            `Thank you for using %@ and supporting independent software. Get the most out of your subscription: explore pro features below or visit the %@ to learn more about reminders, templates, activity insights, and more.`,
            <strong
              style={{ textTransform: 'capitalize' }}
            >{`Mailspring ${planDisplayName}`}</strong>,
            <a href="https://getmailspring.com/docs/quick-start-guide">
              {localized(`Help Center`)}
            </a>
          )}
          {unpaidNote}
        </div>
        <ExploreMailspringPro />
        <div style={{ paddingTop: 15 }}>
          <OpenIdentityPageButton
            label={localized('Manage Billing')}
            path="/dashboard#billing"
            source="Preferences Billing"
            campaign="Dashboard"
          />
        </div>
      </div>
    );
  }

  render() {
    const { identity } = this.state;
    const stripePlan = identity ? identity.stripePlan : null;

    return (
      <div className="container-identity">
        <div className="identity-content-box">
          {identity && <IdentitySummary identity={identity} />}

          {!stripePlan
            ? this._renderNoIdentity()
            : stripePlan === 'Basic'
              ? this._renderBasicPlan()
              : this._renderPaidPlan(stripePlan, identity.stripePlanEffective)}
        </div>
      </div>
    );
  }
}

const ProChecklist: { feature?: string; title: string }[] = [
  { title: localized(`Rich contact profiles`) },
  { feature: 'send-reminders', title: localized(`Follow-up reminders`) },
  { title: localized(`Read Receipts`) },
  { title: localized(`Link tracking`) },
  { title: localized(`Powerful template support`) },
  { feature: 'send-later', title: localized(`Send Later`) },
  { title: localized(`Company overviews`) },
  { feature: 'snooze', title: localized(`Snooze messages`) },
  { title: localized(`Mailbox insights`) },
  { title: localized(`... and much more!`) },
];

const ExploreMailspringSmall: React.FunctionComponent = () => {
  const items = ProChecklist.filter(isOfferedAsPro);
  const half = Math.ceil(items.length / 2);
  return (
    <div className="features">
      {[items.slice(0, half), items.slice(half)].map((column, idx) => (
        <ul key={idx}>
          {column.map((item) => (
            <li key={item.title}>
              <RetinaImg
                name="pro-feature-checkmark.png"
                style={{ paddingRight: 8 }}
                mode={RetinaImg.Mode.ContentDark}
              />
              {item.title}
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
};

const ExploreMailspringPro: React.FunctionComponent = () => (
  <>
    <div className="feature-explore-title">{localized('Explore Mailspring Pro')}</div>
    <div className="feature-explore-grid">
      {ProTourFeatures.filter(isOfferedAsPro).map((item) => (
        <a key={item.title} className="feature" href={item.link}>
          <div className="popout">
            <RetinaImg name="thread-popout.png" mode={RetinaImg.Mode.ContentDark} />
          </div>
          <h3>
            <RetinaImg
              name={item.icon}
              style={{ paddingRight: 8 }}
              mode={RetinaImg.Mode.ContentDark}
            />
            {item.title}
          </h3>
          <p>{item.text}</p>
        </a>
      ))}
    </div>
  </>
);

const IdentitySummary: React.FunctionComponent<{ identity: IIdentity }> = (props) => {
  const { firstName, lastName, emailAddress } = props.identity;
  const logout = () => Actions.logoutMailspringIdentity();
  return (
    <div className="row padded">
      <div className="identity-info">
        <RefreshButton />
        <div className="name">
          {firstName} {lastName}
        </div>
        <div className="email">{emailAddress}</div>
        <div className="identity-actions">
          <OpenIdentityPageButton
            label={localized('Account Details')}
            path="/dashboard"
            source="Preferences"
            campaign="Dashboard"
          />
          <div className="btn minor-width" onClick={logout}>
            {localized('Sign Out')}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PreferencesIdentity;
