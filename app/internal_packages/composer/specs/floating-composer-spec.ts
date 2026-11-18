import { Actions, DraftStore, Message } from 'mailspring-exports';
import { FloatingComposerStore } from '../lib/floating-composer-store';

const ids = () => FloatingComposerStore.entries().map((e) => e.headerMessageId);

describe('Floating composer', function () {
  beforeEach(function () {
    FloatingComposerStore._entries = [];
    FloatingComposerStore._handedToWindow.clear();
  });

  describe('FloatingComposerStore', function () {
    it('opens one panel per draft, oldest first, closing the oldest past three', function () {
      ['a', 'b', 'c', 'd'].forEach((id) => FloatingComposerStore._onOpen(id, { newDraft: true }));
      expect(ids()).toEqual(['b', 'c', 'd']);
    });

    it('restores an already open draft instead of adding a second panel', function () {
      FloatingComposerStore._onOpen('a');
      FloatingComposerStore.setMode('a', 'minimized');
      FloatingComposerStore._onOpen('a');
      expect(FloatingComposerStore.entries()).toEqual([
        { headerMessageId: 'a', mode: 'normal', newDraft: false },
      ]);
    });

    it('lets only one panel fill the window', function () {
      FloatingComposerStore._onOpen('a');
      FloatingComposerStore._onOpen('b');
      FloatingComposerStore.setMode('a', 'maximized');
      FloatingComposerStore.setMode('b', 'maximized');
      expect(FloatingComposerStore.entries().map((e) => e.mode)).toEqual(['normal', 'maximized']);
    });

    it('closes the panel when its draft is sent or discarded', function () {
      FloatingComposerStore._onOpen('a');
      FloatingComposerStore._onOpen('b');
      FloatingComposerStore._onClose('a');
      FloatingComposerStore._onDestroy({ headerMessageId: 'b' });
      expect(ids()).toEqual([]);
    });

    it('remembers drafts popped out to a window so their panel keeps them', function () {
      FloatingComposerStore._onOpen('a');
      FloatingComposerStore._onPopout('a', { inWindow: true });
      expect(ids()).toEqual([]);
      expect(FloatingComposerStore.wasHandedToWindow('a')).toBe(true);
    });

    it('ignores pop-outs that are routed back into a panel', function () {
      FloatingComposerStore._onOpen('a');
      FloatingComposerStore._onPopout('a', {});
      expect(ids()).toEqual(['a']);
      expect(FloatingComposerStore.wasHandedToWindow('a')).toBe(false);
    });
  });

  describe('DraftStore routing', function () {
    beforeEach(function () {
      const draft = new Message({ headerMessageId: 'A', subject: 'Hi' });
      const session = { draft: () => draft, changes: { commit: () => Promise.resolve() } };
      spyOn(DraftStore, 'sessionForClientId').andReturn(Promise.resolve(session));
      spyOn(AppEnv, 'newWindow');
      spyOn(Actions, 'composeInFloatingPanel');
      this.setting = AppEnv.config.get('core.composing.floatingComposer');
    });

    afterEach(function () {
      AppEnv.config.set('core.composing.floatingComposer', this.setting);
    });

    it('opens drafts in a floating panel in the main window', function () {
      spyOn(AppEnv, 'isMainWindow').andReturn(true);
      AppEnv.config.set('core.composing.floatingComposer', true);
      waitsForPromise(() =>
        DraftStore._onPopoutDraft('A', { newDraft: true }).then(() => {
          expect(Actions.composeInFloatingPanel).toHaveBeenCalledWith('A', { newDraft: true });
          expect(AppEnv.newWindow).not.toHaveBeenCalled();
        })
      );
    });

    it('opens a composer window when one is asked for', function () {
      spyOn(AppEnv, 'isMainWindow').andReturn(true);
      AppEnv.config.set('core.composing.floatingComposer', true);
      waitsForPromise(() =>
        DraftStore._onPopoutDraft('A', { inWindow: true }).then(() => {
          expect(Actions.composeInFloatingPanel).not.toHaveBeenCalled();
          const { windowType, windowProps } = (AppEnv.newWindow as any).calls[0].args[0];
          expect(windowType).toBe('composer');
          expect(windowProps.inWindow).toBeUndefined();
        })
      );
    });

    it('opens a composer window when the setting is off', function () {
      spyOn(AppEnv, 'isMainWindow').andReturn(true);
      AppEnv.config.set('core.composing.floatingComposer', false);
      waitsForPromise(() =>
        DraftStore._onPopoutDraft('A').then(() => {
          expect(Actions.composeInFloatingPanel).not.toHaveBeenCalled();
          expect(AppEnv.newWindow).toHaveBeenCalled();
        })
      );
    });

    it('opens a composer window from other windows', function () {
      spyOn(AppEnv, 'isMainWindow').andReturn(false);
      AppEnv.config.set('core.composing.floatingComposer', true);
      waitsForPromise(() =>
        DraftStore._onPopoutDraft('A').then(() => {
          expect(Actions.composeInFloatingPanel).not.toHaveBeenCalled();
          expect(AppEnv.newWindow).toHaveBeenCalled();
        })
      );
    });
  });
});
