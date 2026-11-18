import { WorkspaceStore } from 'mailspring-exports';

describe('WorkspaceStore theme layout', function () {
  beforeEach(function () {
    spyOn(WorkspaceStore, '_onSelectLayoutMode');
  });

  it('switches to the layout a newly chosen theme is designed around', function () {
    spyOn(AppEnv.themes, 'getActiveTheme').andReturn({ preferredLayoutMode: 'list' });
    WorkspaceStore._onThemeChosen();
    advanceClock(1);
    expect(WorkspaceStore._onSelectLayoutMode).toHaveBeenCalledWith('list');
  });

  it('leaves the layout alone for themes without a preference', function () {
    spyOn(AppEnv.themes, 'getActiveTheme').andReturn({ preferredLayoutMode: null });
    WorkspaceStore._onThemeChosen();
    advanceClock(1);
    expect(WorkspaceStore._onSelectLayoutMode).not.toHaveBeenCalled();
  });
});

describe('WorkspaceStore theme preferences', function () {
  beforeEach(function () {
    spyOn(WorkspaceStore, '_onSelectLayoutMode');
    spyOn(WorkspaceStore, '_onToggleLocationHidden');
    spyOn(AppEnv.config, 'set');
  });

  it('hides the panels a newly chosen theme leaves out, unless already hidden', function () {
    // Locations are only defined in the main window; specs run in their own.
    const location = { id: 'MessageListSidebar' };
    const savedLocations = WorkspaceStore.Location;
    WorkspaceStore.Location = { ...savedLocations, MessageListSidebar: location } as any;
    spyOn(WorkspaceStore, 'isLocationHidden').andReturn(false);
    spyOn(AppEnv.themes, 'getActiveTheme').andReturn({
      preferredHiddenLocations: ['MessageListSidebar'],
    });
    WorkspaceStore._onThemeChosen();
    advanceClock(1);
    expect(WorkspaceStore._onToggleLocationHidden).toHaveBeenCalledWith(location);
    WorkspaceStore.Location = savedLocations;
  });

  it("doesn't show a panel the theme leaves out that was already hidden", function () {
    spyOn(WorkspaceStore, 'isLocationHidden').andReturn(true);
    spyOn(AppEnv.themes, 'getActiveTheme').andReturn({
      preferredHiddenLocations: ['MessageListSidebar'],
    });
    WorkspaceStore._onThemeChosen();
    advanceClock(1);
    expect(WorkspaceStore._onToggleLocationHidden).not.toHaveBeenCalled();
  });

  it('keeps folders beside an open message when the theme asks for it', function () {
    spyOn(AppEnv.themes, 'getActiveTheme').andReturn({ preferredFoldersBesideMessage: true });
    WorkspaceStore._onThemeChosen();
    advanceClock(1);
    expect(AppEnv.config.set).toHaveBeenCalledWith('core.workspace.foldersBesideMessage', true);
  });
});
