import React from 'react';
import { localized, Thread } from 'mailspring-exports';
import { HasTutorialTip, RetinaImg } from 'mailspring-component-kit';
import SendRemindersPopoverButton from './send-reminders-popover-button';

const SendRemindersPopoverButtonWithTip = HasTutorialTip(SendRemindersPopoverButton, {
  title: localized('Get reminded!'),
  instructions: localized(
    "Get reminded if you don't receive a reply for this message within a specified time."
  ),
});

// The strip above an open message keeps its buttons in fixed places, so where a reminder
// can't be set it shows the button disabled and says why, rather than leaving a gap.
function UnavailableReminderButton() {
  const label = localized('Reminders work on conversations where you sent the last message');
  return (
    <button
      className="btn btn-toolbar send-reminders-toolbar-button"
      disabled
      title={label}
      aria-label={label}
    >
      <RetinaImg
        name="ic-toolbar-native-reminder.png"
        mode={RetinaImg.Mode.ContentIsMask}
        aria-hidden="true"
      />
    </button>
  );
}

export default function SendRemindersToolbarButton(props: {
  items: Thread[];
  inReaderStrip?: boolean;
}) {
  const threads = props.items;
  const unavailable = props.inReaderStrip ? <UnavailableReminderButton /> : <span />;
  if (threads.length > 1) {
    return unavailable;
  }
  const thread = threads[0];

  // you can only set a reminder if the last message on the thread was sent by you
  if (thread.lastMessageSentTimestamp < thread.lastMessageReceivedTimestamp) {
    return unavailable;
  }

  return <SendRemindersPopoverButtonWithTip thread={thread} />;
}

SendRemindersToolbarButton.containerRequired = false;
SendRemindersToolbarButton.displayName = 'SendRemindersToolbarButton';
