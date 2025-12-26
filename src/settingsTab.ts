import {
    App,
    TextComponent,
    PluginSettingTab,
    TextAreaComponent,
    Setting,
    DropdownComponent,
} from 'obsidian';

import MapViewPlugin from 'src/main';
import {
    type OpenBehavior,
    type UrlParsingRuleType,
    type UrlParsingContentType,
    type GeoHelperType,
    type LinkNamePopupBehavior,
    type DisplayRule,
    DEFAULT_SETTINGS,
} from 'src/settings';
import { BaseMapView } from 'src/baseMapView';
import * as consts from 'src/consts';
import { DEFAULT_MAX_TILE_ZOOM, MAX_ZOOM } from 'src/consts';
import { openManagerDialog } from 'src/offlineTiles.svelte';
import { SvelteModal } from 'src/svelte';
import DisplayRules from './components/DisplayRules.svelte';

export class SettingsTab extends PluginSettingTab {
    plugin: MapViewPlugin;
    private refreshPluginOnHide: boolean = false;

    constructor(app: App, plugin: MapViewPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        let { containerEl } = this;

        containerEl.empty();

        containerEl.createEl('h2', {
            text: '中文地图视图插件设置',
        });

        new Setting(containerEl)
            .setName('预加载标记和路径')
            .setDesc(
                '在Obsidian启动时在后台加载地图标记和路径缓存。这大大加快了地图视图的速度，但即使不使用也会占用内存。关闭时，只有在首次使用地图视图时才会加载地图内容。',
            )
            .addToggle((component) => {
                component
                    .setValue(this.plugin.settings.loadLayersAhead)
                    .onChange(async (value) => {
                        this.plugin.settings.loadLayersAhead = value;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName('地图跟随搜索结果')
            .setDesc('自动缩放和平移地图以适应搜索结果，包括跟随活动笔记功能。')
            .addToggle((component) => {
                component
                    .setValue(this.plugin.settings.autoZoom)
                    .onChange(async (value) => {
                        this.plugin.settings.autoZoom = value;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName('每次只展开一个控制面板')
            .setDesc(
                '每次只保持一个控制面板展开，即点击另一个面板时折叠当前展开的面板。（重启地图视图后生效）',
            )
            .addToggle((component) => {
                component
                    .setValue(this.plugin.settings.onlyOneExpanded)
                    .onChange(async (value) => {
                        this.plugin.settings.onlyOneExpanded = value;
                        await this.plugin.saveSettings();
                    });
            });

        let apiKeyControl: Setting = null;
        let osmUser: Setting = null;
        new Setting(containerEl)
            .setName('地理编码搜索提供商')
            .setDesc(
                '用于搜索地理位置的服务。要使用Google服务，请查看插件文档了解详情。',
            )
            .addDropdown((component) => {
                component
                    .addOption('osm', 'OpenStreetMap')
                    .addOption('google', 'Google（需要API密钥）')
                    .addOption('amap', '高德地图（需要API密钥）')
                    .setValue(
                        this.plugin.settings.searchProvider ||
                            DEFAULT_SETTINGS.searchProvider,
                    )
                    .onChange(async (value: 'osm' | 'google' | 'amap') => {
                        this.plugin.settings.searchProvider = value;
                        await this.plugin.saveSettings();
                        this.refreshPluginOnHide = true;
                        osmUser.settingEl.style.display =
                            value === 'osm' ? '' : 'none';
                        apiKeyControl.settingEl.style.display =
                            value === 'google' ? '' : 'none';
                        googlePlacesControl.settingEl.style.display =
                            this.plugin.settings.searchProvider === 'google'
                                ? ''
                                : 'none';
                        googlePlacesDataFields.settingEl.style.display =
                            googlePlacesControl.settingEl.style.display;
                        amapApiKeyControl.settingEl.style.display =
                            value === 'amap' ? '' : 'none';
                    });
            });

        osmUser = new Setting(containerEl)
            .setName('OpenStreetMap用户邮箱')
            .setDesc(
                'The OpenStreetMap Nominatim provider requires a user email. Restart Map View after setting it.',
            )
            .addText((component) => {
                component
                    .setValue(this.plugin.settings.osmUser)
                    .onChange(async (value) => {
                        this.plugin.settings.osmUser = value;
                        await this.plugin.saveSettings();
                        component.inputEl.style.borderColor = value
                            ? ''
                            : 'red';
                    });
                component.inputEl.style.borderColor = this.plugin.settings
                    .osmUser
                    ? ''
                    : 'red';
            });

        apiKeyControl = new Setting(containerEl)
            .setName('地理编码API密钥')
            .setDesc(
                'If using Google as the geocoding search provider, paste the API key here. See the plugin documentation for more details. Changes are applied after restart.',
            )
            .addText((component) => {
                component
                    .setValue(this.plugin.settings.geocodingApiKey)
                    .onChange(async (value) => {
                        this.plugin.settings.geocodingApiKey = value;
                        await this.plugin.saveSettings();
                        component.inputEl.style.borderColor = value
                            ? ''
                            : 'red';
                    });
                component.inputEl.style.borderColor = this.plugin.settings
                    .geocodingApiKey
                    ? ''
                    : 'red';
            });
        let amapApiKeyControl = new Setting(containerEl)
            .setName('高德地理编码 API Key')
            .setDesc(
                'If using AMap as the geocoding search provider, paste the API key here. See the plugin documentation for more details. Changes are applied after restart.',
            )
            .addText((component) => {
                component
                    .setValue(this.plugin.settings.amapApiKey)
                    .onChange(async (value) => {
                        this.plugin.settings.amapApiKey = value;
                        await this.plugin.saveSettings();
                        component.inputEl.style.borderColor = value
                            ? ''
                            : 'red';
                    });
                component.inputEl.style.borderColor = this.plugin.settings
                    .amapApiKey
                    ? ''
                    : 'red';
            });
        let googlePlacesControl = new Setting(containerEl)
            .setName('使用Google Places进行搜索')
            .setDesc(
                'Use Google Places API instead of Google Geocoding to get higher-quality results. Your API key must have a specific "Google Places (New)" permission turned on! See the plugin documentation for more details.',
            )
            .addToggle((component) => {
                component
                    .setValue(
                        this.plugin.settings.useGooglePlacesNew2025 ??
                            DEFAULT_SETTINGS.useGooglePlacesNew2025,
                    )
                    .onChange(async (value) => {
                        this.plugin.settings.useGooglePlacesNew2025 = value;
                        await this.plugin.saveSettings();
                    });
            });
        let googlePlacesDataFields = new Setting(containerEl)
            .setName('Google Places查询数据字段')
            .setDesc(
                'To use Places API templates (see the documentation -- i.e. "googleMapsPlaceData.place_id"), enlist here the fields you are interested to query, separated by commas, e.g. place_id,business_status.',
            )
            .addText((component) => {
                component
                    .setValue(
                        this.plugin.settings.googlePlacesDataFields ||
                            DEFAULT_SETTINGS.googlePlacesDataFields,
                    )
                    .onChange(async (value: string) => {
                        this.plugin.settings.googlePlacesDataFields = value;
                        this.plugin.saveSettings();
                    });
            });

        // Display the user or API key control only if the search provider requires it
        osmUser.settingEl.style.display =
            this.plugin.settings.searchProvider === 'osm' ? '' : 'none';
        amapApiKeyControl.settingEl.style.display =
            this.plugin.settings.searchProvider === 'amap' ? '' : 'none';
        apiKeyControl.settingEl.style.display =
            this.plugin.settings.searchProvider === 'google' ? '' : 'none';
        googlePlacesControl.settingEl.style.display =
            this.plugin.settings.searchProvider === 'google' ? '' : 'none';
        googlePlacesDataFields.settingEl.style.display =
            googlePlacesControl.settingEl.style.display;
        new Setting(containerEl)
            .setName('输入时的搜索延迟')
            .setDesc(
                'Delay in ms to wait before searching while you type (required to not flood the search provider with every key). In the OSM search provider, a minimum of 1 second is required and enforced.',
            )
            .addSlider((slider) => {
                slider
                    .setLimits(100, 2000, 50)
                    .setDynamicTooltip()
                    .setValue(
                        this.plugin.settings.searchDelayMs ??
                            DEFAULT_SETTINGS.searchDelayMs,
                    )
                    .onChange(async (value: number) => {
                        this.plugin.settings.searchDelayMs = value;
                        this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName('新笔记名称格式')
            .setDesc(
                'Date/times in the format can be wrapped in {{date:...}}, e.g. "note-{{date:YYYY-MM-DD}}". Search queries can be added with {{query}}.',
            )
            .addText((component) => {
                component
                    .setValue(
                        this.plugin.settings.newNoteNameFormat ||
                            DEFAULT_SETTINGS.newNoteNameFormat,
                    )
                    .onChange(async (value: string) => {
                        this.plugin.settings.newNoteNameFormat = value;
                        this.plugin.saveSettings();
                    });
            });
        new Setting(containerEl)
            .setName('新笔记路径')
            .setDesc('Disk path for notes created from the map.')
            .addText((component) => {
                component
                    .setValue(this.plugin.settings.newNotePath || '')
                    .onChange(async (value: string) => {
                        this.plugin.settings.newNotePath = value;
                        this.plugin.saveSettings();
                    });
            });
        new Setting(containerEl)
            .setName('模板文件路径')
            .setDesc(
                'Choose the file to use as a template, e.g. "templates/map-log.md".',
            )
            .addText((component) => {
                component
                    .setValue(this.plugin.settings.newNoteTemplate || '')
                    .onChange(async (value: string) => {
                        this.plugin.settings.newNoteTemplate = value;
                        this.plugin.saveSettings();
                    });
            });
        new Setting(containerEl)
            .setName('聚类最大像素大小')
            .setDesc(
                'Maximal radius in pixels to cover in a marker cluster. Higher values will group more markers together, which leads to better performance. (Requires restart.)',
            )
            .addSlider((slider) => {
                slider
                    .setLimits(0, 200, 5)
                    .setDynamicTooltip()
                    .setValue(
                        this.plugin.settings.maxClusterRadiusPixels ??
                            DEFAULT_SETTINGS.maxClusterRadiusPixels,
                    )
                    .onChange(async (value: number) => {
                        this.plugin.settings.maxClusterRadiusPixels = value;
                        this.plugin.saveSettings();
                    });
            });
        new Setting(containerEl)
            .setName('"在地图上显示"操作的默认缩放级别')
            .setDesc(
                'When jumping to the map from a note, what should be the display zoom? This is also used as a max zoom for "Map follows search results" above.',
            )
            .addSlider((component) => {
                component
                    .setLimits(1, 18, 1)
                    .setDynamicTooltip()
                    .setValue(
                        this.plugin.settings.zoomOnGoFromNote ??
                            DEFAULT_SETTINGS.zoomOnGoFromNote,
                    )
                    .onChange(async (value) => {
                        this.plugin.settings.zoomOnGoFromNote = value;
                        await this.plugin.saveSettings();
                    });
            });
        new Setting(containerEl)
            .setName('允许超过定义最大值的缩放')
            .setDesc(
                'Allow zooming further than the maximum defined for the map source, interpolating the image of the highest available zoom.',
            )
            .addToggle((component) => {
                component
                    .setValue(
                        this.plugin.settings.letZoomBeyondMax ??
                            DEFAULT_SETTINGS.letZoomBeyondMax,
                    )
                    .onChange(async (value) => {
                        this.plugin.settings.letZoomBeyondMax = value;
                        this.refreshPluginOnHide = true;
                        await this.plugin.saveSettings();
                    });
            });
        new Setting(containerEl)
            .setName('保存前进/后退历史')
            .setDesc(
                'While making changes to the map, save the history to be browsable through Obsidian back/forward buttons.',
            )
            .addToggle((component) => {
                component
                    .setValue(this.plugin.settings.saveHistory)
                    .onChange(async (value) => {
                        this.plugin.settings.saveHistory = value;
                        await this.plugin.saveSettings();
                    });
            });
        new Setting(containerEl)
            .setName('"跟随活跃笔记"的查询格式')
            .setDesc(
                'What query to use for following active notes (in the main or mini view), $PATH$ being the file path.',
            )
            .addText((component) => {
                component
                    .setValue(
                        this.plugin.settings.queryForFollowActiveNote ||
                            DEFAULT_SETTINGS.queryForFollowActiveNote,
                    )
                    .onChange(async (value: string) => {
                        this.plugin.settings.queryForFollowActiveNote = value;
                        this.plugin.saveSettings();
                    });
            });
        new Setting(containerEl)
            .setName('粘贴内联地理位置时修复前置内容')
            .setDesc(
                'Monitor the clipboard and add a "locations:" front-matter if a supported geolocation is pasted from the keyboard.',
            )
            .addToggle((component) => {
                component
                    .setValue(
                        this.plugin.settings.fixFrontMatterOnPaste ??
                            DEFAULT_SETTINGS.fixFrontMatterOnPaste,
                    )
                    .onChange(async (value: boolean) => {
                        this.plugin.settings.fixFrontMatterOnPaste = value;
                        this.plugin.saveSettings();
                    });
            });
        new Setting(containerEl)
            .setName('前置内容位置的键名')
            .setDesc(
                'The key Map View uses to denote a front matter geolocation. Restart required. Beware: changing this will make your old front matter key not recognized as geolocations by Map View.',
            )
            .addText((component) => {
                component
                    .setValue(
                        this.plugin.settings.frontMatterKey ??
                            DEFAULT_SETTINGS.frontMatterKey,
                    )
                    .onChange(async (value: string) => {
                        this.plugin.settings.frontMatterKey = value;
                        this.plugin.saveSettings();
                    });
            });
        new Setting(containerEl)
            .setName('标记内联地理位置的标签名')
            .setDesc(
                'Instead or in addition to the "locations:" YAML tag, you can use a regular tag that will mark for Map View that a note has inline geolocations, e.g. "#hasLocations". (Note: this has a performance penalty for the time being.)',
            )
            .addText((component) => {
                component
                    .setValue(this.plugin.settings.tagForGeolocationNotes ?? '')
                    .onChange(async (value: string) => {
                        this.plugin.settings.tagForGeolocationNotes = value;
                        this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setHeading()
            .setName('笔记中的地理链接')
            .setDesc(
                'How and if Map View handles geolinks in notes (both front matter and inline)',
            );
        new Setting(containerEl)
            .setName('处理笔记中的地理链接')
            .setDesc(
                'When turned on, Map View will handle geolinks internally, and turn front matter locations into links. (Requires restarting Obsidian to update correctly.)',
            )
            .addToggle((component) => {
                component
                    .setValue(
                        this.plugin.settings.handleGeolinksInNotes ??
                            DEFAULT_SETTINGS.handleGeolinksInNotes,
                    )
                    .onChange(async (value) => {
                        this.plugin.settings.handleGeolinksInNotes = value;
                        await this.plugin.saveSettings();
                    });
            });
        new Setting(containerEl)
            .setName('在笔记中显示地理链接预览')
            .setDesc(
                'Show a popup with a map preview when hovering on geolinks in notes. Requires "Geolinks in Notes" above.',
            )
            .addToggle((component) => {
                component
                    .setValue(
                        this.plugin.settings.showGeolinkPreview ??
                            DEFAULT_SETTINGS.showGeolinkPreview,
                    )
                    .onChange(async (value) => {
                        this.plugin.settings.showGeolinkPreview = value;
                        await this.plugin.saveSettings();
                    });
            });
        new Setting(containerEl)
            .setName('地理链接地图预览的缩放级别')
            .setDesc('Zoom level to use for the geolink map preview popup.')
            .addSlider((component) => {
                component
                    .setLimits(1, 18, 1)
                    .setDynamicTooltip()
                    .setValue(
                        this.plugin.settings.zoomOnGeolinkPreview ??
                            DEFAULT_SETTINGS.zoomOnGeolinkPreview,
                    )
                    .onChange(async (value) => {
                        this.plugin.settings.zoomOnGeolinkPreview = value;
                        await this.plugin.saveSettings();
                    });
            });
        new Setting(containerEl)
            .setName('笔记中的地理链接上下文菜单')
            .setDesc(
                'Override the Obsidian context menu for geolinks in notes, making sure Map View "open in" items are shown correctly. Requires "Geolinks in Notes" above. Does not currently work in iOS.',
            )
            .addToggle((component) => {
                component
                    .setValue(
                        this.plugin.settings.handleGeolinkContextMenu ??
                            DEFAULT_SETTINGS.handleGeolinkContextMenu,
                    )
                    .onChange(async (value) => {
                        this.plugin.settings.handleGeolinkContextMenu = value;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setHeading()
            .setName('标记悬停和预览')
            .setDesc(
                'What is shown when hovering (desktop) or clicking (mobile) map markers.',
            );
        new Setting(containerEl)
            .setName('标记悬停时显示笔记名称')
            .setDesc(
                'Show a popup with the note name when hovering on a map marker.',
            )
            .addToggle((component) => {
                component
                    .setValue(this.plugin.settings.showNoteNamePopup)
                    .onChange(async (value) => {
                        this.plugin.settings.showNoteNamePopup = value;
                        await this.plugin.saveSettings();
                    });
            });
        new Setting(containerEl)
            .setName('标记悬停时显示内联链接名称')
            .setDesc(
                'In the popup above, show also the link name, in the case of an inline link.',
            )
            .addDropdown((component) => {
                component
                    .addOption('always', 'Always')
                    .addOption('mobileOnly', 'Only on mobile')
                    .addOption('never', 'Never')
                    .setValue(
                        this.plugin.settings.showLinkNameInPopup ??
                            DEFAULT_SETTINGS.showLinkNameInPopup,
                    )
                    .onChange(async (value) => {
                        this.plugin.settings.showLinkNameInPopup =
                            value as LinkNamePopupBehavior;
                        await this.plugin.saveSettings();
                    });
            });
        new Setting(containerEl)
            .setName('标记悬停时显示笔记预览')
            .setDesc(
                'In addition to the note name, show a preview if the note contents. Either way, it will be displayed only if the map is large enough to contain it.',
            )
            .addToggle((component) => {
                component
                    .setValue(this.plugin.settings.showNotePreview)
                    .onChange(async (value) => {
                        this.plugin.settings.showNotePreview = value;
                        await this.plugin.saveSettings();
                    });
            });
        new Setting(containerEl)
            .setName('标记悬停时显示原生Obsidian弹窗')
            .setDesc(
                'In addition to the above settings, trigger the native Obsidian note preview when hovering on a marker. ' +
                    'The native Obsidian preview is more feature-rich than the above, and not recommended together with it, but Map View cannot control its placement and cannot add to it the note name, marker name etc.',
            )
            .addToggle((component) => {
                component
                    .setValue(this.plugin.settings.showNativeObsidianHoverPopup)
                    .onChange(async (value) => {
                        this.plugin.settings.showNativeObsidianHoverPopup =
                            value;
                        await this.plugin.saveSettings();
                    });
            });
        new Setting(containerEl)
            .setName('显示标记聚类预览')
            .setDesc(
                'Show a hover popup summarizing the icons inside a marker cluster.',
            )
            .addToggle((component) => {
                component
                    .setValue(this.plugin.settings.showClusterPreview)
                    .onChange(async (value) => {
                        this.plugin.settings.showClusterPreview = value;
                        this.refreshPluginOnHide = true;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setHeading()
            .setName('面板和标签页使用')
            .setDesc(
                'Control when and if Map View should use panes vs tabs, new panes vs existing ones etc.',
            );

        // Name is 'click', 'Ctrl+click' and 'middle click'
        const addOpenBehaviorOptions = (
            setting: Setting,
            setValue: (value: OpenBehavior) => void,
            getValue: () => OpenBehavior,
            includeLatest: boolean,
        ) => {
            setting.addDropdown((component) => {
                component
                    .addOption(
                        'replaceCurrent',
                        'Open in same pane (replace Map View)',
                    )
                    .addOption(
                        'dedicatedPane',
                        'Open in a 2nd pane and keep reusing it',
                    )
                    .addOption('alwaysNew', 'Always open a new pane')
                    .addOption(
                        'dedicatedTab',
                        'Open in a new tab and keep reusing it',
                    )
                    .addOption('alwaysNewTab', 'Always open a new tab');
                if (includeLatest)
                    component.addOption('lastUsed', 'Open in last-used pane');
                component
                    .setValue(getValue() || 'samePane')
                    .onChange(async (value: OpenBehavior) => {
                        setValue(value);
                        this.plugin.saveSettings();
                    });
            });
        };

        addOpenBehaviorOptions(
            new Setting(containerEl)
                .setName('地图标记点击的默认操作')
                .setDesc(
                    'How should the corresponding note be opened following a click on a marker?',
                ),
            (value: OpenBehavior) => {
                this.plugin.settings.markerClickBehavior = value;
            },
            () => {
                return this.plugin.settings.markerClickBehavior;
            },
            true,
        );
        addOpenBehaviorOptions(
            new Setting(containerEl)
                .setName('地图标记Ctrl+点击的默认操作')
                .setDesc(
                    'How should the corresponding note be opened following a Ctrl+click on a marker?',
                ),
            (value: OpenBehavior) => {
                this.plugin.settings.markerCtrlClickBehavior = value;
            },
            () => {
                return this.plugin.settings.markerCtrlClickBehavior;
            },
            true,
        );
        addOpenBehaviorOptions(
            new Setting(containerEl)
                .setName('地图标记中键点击的默认操作')
                .setDesc(
                    'How should the corresponding note be opened following a middle-click on a marker?',
                ),
            (value: OpenBehavior) => {
                this.plugin.settings.markerMiddleClickBehavior = value;
            },
            () => {
                return this.plugin.settings.markerMiddleClickBehavior;
            },
            true,
        );

        addOpenBehaviorOptions(
            new Setting(containerEl)
                .setName('打开地图视图的默认模式')
                .setDesc(
                    'How should Map View open by default (e.g. when clicking the ribbon icon, or from within a note).',
                ),
            (value: OpenBehavior) => {
                this.plugin.settings.openMapBehavior = value;
            },
            () => {
                return this.plugin.settings.openMapBehavior;
            },
            false,
        );
        addOpenBehaviorOptions(
            new Setting(containerEl)
                .setName('使Ctrl+点击打开地图视图')
                .setDesc('How should Map View open when Ctrl is pressed.'),
            (value: OpenBehavior) => {
                this.plugin.settings.openMapCtrlClickBehavior = value;
            },
            () => {
                return this.plugin.settings.openMapCtrlClickBehavior;
            },
            false,
        );
        addOpenBehaviorOptions(
            new Setting(containerEl)
                .setName('使用中键点击打开地图视图')
                .setDesc('How should Map View open when using middle-click.'),
            (value: OpenBehavior) => {
                this.plugin.settings.openMapMiddleClickBehavior = value;
            },
            () => {
                return this.plugin.settings.openMapMiddleClickBehavior;
            },
            false,
        );

        new Setting(containerEl)
            .setName('新面板分割方向')
            .setDesc(
                'Which way should the pane be split when opening in a new pane.',
            )
            .addDropdown((component) => {
                component
                    .addOption('horizontal', 'Horizontal')
                    .addOption('vertical', 'Vertical')
                    .setValue(
                        this.plugin.settings.newPaneSplitDirection ||
                            'horizontal',
                    )
                    .onChange(async (value: any) => {
                        this.plugin.settings.newPaneSplitDirection = value;
                        this.plugin.saveSettings();
                    });
            });

        const mapSources = new Setting(containerEl)
            .setHeading()
            .setName('地图源');
        mapSources.descEl.innerHTML = `更改和切换地图瓦片源。可以为每个源定义可选的深色模式URL。如果没有定义此类URL并且使用深色模式，地图颜色将反转。更多详情请参阅<a href="https://github.com/esm7/obsidian-map-view?tab=readme-ov-file#map-sources">文档</a>。`;

        let mapSourcesDiv: HTMLDivElement = null;
        new Setting(containerEl).addButton((component) =>
            component.setButtonText('新建地图源').onClick(() => {
                this.plugin.settings.mapSources.push({
                    name: '',
                    urlLight: '',
                    maxZoom: DEFAULT_MAX_TILE_ZOOM,
                    currentMode: 'auto',
                });
                this.refreshMapSourceSettings(mapSourcesDiv);
                this.refreshPluginOnHide = true;
            }),
        );
        mapSourcesDiv = containerEl.createDiv();
        this.refreshMapSourceSettings(mapSourcesDiv);

        new Setting(containerEl)
            .setHeading()
            .setName('自定义"在....中打开"操作')
            .setDesc(
                "'Open in' actions showing in geolocation-relevant popup menus. URL should have {x} and {y} as parameters to transfer, and an optional {name} parameter can be used.",
            );

        let openInActionsDiv: HTMLDivElement = null;
        new Setting(containerEl).addButton((component) =>
            component.setButtonText('New Custom Action').onClick(() => {
                this.plugin.settings.openIn.push({ name: '', urlPattern: '' });
                this.refreshOpenInSettings(openInActionsDiv);
            }),
        );
        openInActionsDiv = containerEl.createDiv();
        this.refreshOpenInSettings(openInActionsDiv);

        new Setting(containerEl)
            .setHeading()
            .setName('URL解析规则')
            .setDesc(
                'Customizable rules for converting URLs of various mapping services to coordinates, for the purpose of the "Convert URL" action.',
            );

        let parsingRulesDiv: HTMLDivElement = null;
        new Setting(containerEl).addButton((component) =>
            component.setButtonText('New Parsing Rule').onClick(() => {
                this.plugin.settings.urlParsingRules.push({
                    name: '',
                    regExp: '',
                    preset: false,
                    ruleType: 'latLng',
                });
                this.refreshUrlParsingRules(parsingRulesDiv);
            }),
        );
        parsingRulesDiv = containerEl.createDiv();
        this.refreshUrlParsingRules(parsingRulesDiv);

        const iconRulesHeading = new Setting(containerEl)
            .setHeading()
            .setName('标记和路径显示规则');
        iconRulesHeading.descEl.innerHTML = `Customize map markers by note tags.
			Refer to <a href="https://fontawesome.com/">Font Awesome</a> for icon names or use <a href="https://emojipedia.org">emojis</a>, and see <a href="https://github.com/coryasilva/Leaflet.ExtraMarkers#properties">here</a> for the other properties.
			<br>The rules override each other, starting from the default. Refer to the plugin documentation for more details.
		`;

        new Setting(containerEl).addButton((component) =>
            component
                .setButtonText('Marker & Path Display Rules...')
                .onClick(() => {
                    const dialog = new SvelteModal(
                        DisplayRules,
                        this.app,
                        this.plugin,
                        this.plugin.settings,
                        {
                            settings: this.plugin.settings,
                            app: this.app,
                            plugin: this.plugin,
                        },
                        ['mod-settings'],
                    );
                    dialog.open();
                }),
        );

        new Setting(containerEl).setHeading().setName('路径、GeoJSON、GPX');
        new Setting(containerEl)
            .setName('处理"geojson"代码块')
            .setDesc("Display an embedded map for a 'geojson' code block.")
            .addToggle((component) => {
                component
                    .setValue(
                        this.plugin.settings.handleGeoJsonCodeBlocks ??
                            DEFAULT_SETTINGS.handleGeoJsonCodeBlocks,
                    )
                    .onChange(async (value) => {
                        this.plugin.settings.handleGeoJsonCodeBlocks = value;
                        await this.plugin.saveSettings();
                    });
            });
        new Setting(containerEl)
            .setName('处理支持的路径嵌入')
            .setDesc(
                'Display an embedded map for embeds (e.g. `![[my path.gpx]]`) of supported path files.',
            )
            .addToggle((component) => {
                component
                    .setValue(
                        this.plugin.settings.handlePathEmbeds ??
                            DEFAULT_SETTINGS.handlePathEmbeds,
                    )
                    .onChange(async (value) => {
                        this.plugin.settings.handlePathEmbeds = value;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl).setHeading().setName('路由');
        new Setting(containerEl)
            .setName('外部路由服务URL')
            .setDesc(
                'URL to use for an external routing service, used for "route to point". {x0},{y0} are the source lat,lng and {x1},{y1} are the destination lat,lng.',
            )
            .addText((component) => {
                component
                    .setValue(
                        this.plugin.settings.routingUrl ??
                            DEFAULT_SETTINGS.routingUrl,
                    )
                    .onChange(async (value: string) => {
                        this.plugin.settings.routingUrl = value;
                        this.plugin.saveSettings();
                    });
            });
        new Setting(containerEl)
            .setName('GraphHopper API密钥')
            .setDesc(
                'You may obtain a free or a paid key from GraphHopper to enable native routing in Map View.',
            )
            .addText((component) => {
                component
                    .setValue(this.plugin.settings.routingGraphHopperApiKey)
                    .onChange(async (value: string) => {
                        this.plugin.settings.routingGraphHopperApiKey = value;
                        this.plugin.saveSettings();
                    });
            });
        new Setting(containerEl)
            .setName('GraphHopper配置文件')
            .setDesc(
                'A comma-delimited list of profiles to support. Note that the free plan supports only the default values listed here.',
            )
            .addText((component) => {
                component
                    .setValue(this.plugin.settings.routingGraphHopperProfiles)
                    .onChange(async (value: string) => {
                        this.plugin.settings.routingGraphHopperProfiles = value;
                        this.plugin.saveSettings();
                    });
            });
        new Setting(containerEl)
            .setName('GraphHopper额外参数（高级）')
            .setDesc(
                'Paste here a JSON (wrapped in {...}) of valid GraphHopper parameters. See the GraphHopper routing POST documentation for more details.',
            )
            .addText((component) => {
                component
                    .setValue(
                        JSON.stringify(
                            this.plugin.settings.routingGraphHopperExtra ?? {},
                        ),
                    )
                    .onChange(async (value: string) => {
                        try {
                            this.plugin.settings.routingGraphHopperExtra =
                                JSON.parse(value);
                        } catch (e) {
                            this.plugin.settings.routingGraphHopperExtra =
                                DEFAULT_SETTINGS.routingGraphHopperExtra;
                        }
                        this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl).setHeading().setName('离线地图');
        new Setting(containerEl)
            .setName('管理离线存储')
            .setDesc(
                'Save and delete tiles for offline usage. Also available via the context menu of the map.',
            )
            .addButton((component) => {
                component.setButtonText('Offline storage...').onClick(() => {
                    const mapView = this.findMapView();
                    if (mapView)
                        openManagerDialog(
                            this.plugin,
                            this.plugin.settings,
                            mapView.mapContainer,
                        );
                    else alert('This requires an open Map View.');
                });
            });
        new Setting(containerEl)
            .setName('自动缓存')
            .setDesc(
                'Automatically store all viewed tiles to be available locally. Great for performance but takes some storage. When this is off, only tiles explicitly downloaded for offline storage are kept.',
            )
            .addToggle((component) => {
                component
                    .setValue(
                        this.plugin.settings.cacheAllTiles ??
                            DEFAULT_SETTINGS.cacheAllTiles,
                    )
                    .onChange(async (value) => {
                        this.plugin.settings.cacheAllTiles = value;
                        await this.plugin.saveSettings();
                    });
            });
        new Setting(containerEl)
            .setName('自动清除超过....的瓦片')
            .setDesc(
                'Remove old tiles on Obsidian startup to keep your map up-to-date. This currently applies both to auto-cached and explicitly downloaded tiles.',
            )
            .addDropdown((component) => {
                component
                    .addOption('1', '1 month')
                    .addOption('3', '3 months')
                    .addOption('6', '6 months')
                    .addOption('12', '12 months')
                    .addOption('0', 'Never')
                    .setValue(
                        (
                            this.plugin.settings.offlineMaxTileAgeMonths ?? 0
                        ).toString(),
                    )
                    .onChange(async (value) => {
                        this.plugin.settings.offlineMaxTileAgeMonths =
                            parseInt(value);
                        await this.plugin.saveSettings();
                    });
            });
        new Setting(containerEl)
            .setName('最大离线瓦片存储（GB）')
            .setDesc(
                'Remove tiles by age on Obsidian startup if the storage size is too high. This currently applies both to auto-cached and explicitly downloaded tiles.',
            )
            .addText((component) => {
                component
                    .setValue(
                        (
                            this.plugin.settings.offlineMaxStorageGb ?? 0
                        ).toString(),
                    )
                    .onChange(async (value) => {
                        const numValue = parseFloat(value);
                        if (!isNaN(numValue) && numValue >= 0) {
                            this.plugin.settings.offlineMaxStorageGb = numValue;
                            await this.plugin.saveSettings();
                        }
                    });
            });

        const gpsTitle = new Setting(containerEl).setHeading().setName('GPS');
        const warningFragment = document.createDocumentFragment();
        const warningText = warningFragment.createDiv();
        warningText.innerHTML =
            '<strong>警告！</strong>这是一个实验性功能，可能效果因人而异。<br>使用前请确保阅读<a href="https://github.com/esm7/obsidian-map-view#gps-location-support">文档</a>。';
        gpsTitle.setDesc(warningFragment);
        new Setting(containerEl)
            .setName('启用实验GPS支持')
            .addToggle((component) => {
                component
                    .setValue(
                        this.plugin.settings.supportRealTimeGeolocation ??
                            DEFAULT_SETTINGS.supportRealTimeGeolocation,
                    )
                    .onChange(async (value) => {
                        this.plugin.settings.supportRealTimeGeolocation = value;
                        await this.plugin.saveSettings();
                    });
            });
        new Setting(containerEl)
            .setName('在移动设备上使用原生应用')
            .addToggle((component) => {
                component
                    .setValue(
                        this.plugin.settings.geoHelperPreferApp ??
                            DEFAULT_SETTINGS.geoHelperPreferApp,
                    )
                    .onChange(async (value) => {
                        this.plugin.settings.geoHelperPreferApp = value;
                        await this.plugin.saveSettings();
                    });
            });
        new Setting(containerEl)
            .setName('地理助手类型')
            .setDesc(
                'If the native app is not used, determines how to launch the geo helper.',
            )
            .addDropdown((component) => {
                component
                    .addOption('url', 'External URL')
                    .addOption('commandline', 'Command line')
                    .setValue(
                        this.plugin.settings.geoHelperType ??
                            DEFAULT_SETTINGS.geoHelperType,
                    )
                    .onChange(async (value) => {
                        this.plugin.settings.geoHelperType =
                            value as GeoHelperType;
                        geoHelperUrl.settingEl.style.display =
                            value === 'url' || 'commandline' ? '' : 'none';
                        geoHelperCommand.settingEl.style.display =
                            value === 'commandline' ? '' : 'none';
                        await this.plugin.saveSettings();
                    });
            });
        const geoHelperCommand = new Setting(containerEl).setName(
            '地理助手命令',
        );
        geoHelperCommand.addText((component) => {
            component
                .setValue(
                    this.plugin.settings.geoHelperCommand ??
                        DEFAULT_SETTINGS.geoHelperCommand,
                )
                .onChange(async (value) => {
                    this.plugin.settings.geoHelperCommand = value;
                    await this.plugin.saveSettings();
                });
        });
        const geoHelperUrl = new Setting(containerEl).setName('地理助手URL');
        geoHelperUrl.addText((component) => {
            component
                .setPlaceholder(
                    'URL to open (directly or using the defined command; see README for more details)',
                )
                .setValue(this.plugin.settings.geoHelperUrl ?? '')
                .onChange(async (value) => {
                    this.plugin.settings.geoHelperUrl = value;
                    await this.plugin.saveSettings();
                });
        });
        geoHelperUrl.settingEl.style.display =
            this.plugin.settings.geoHelperUrl === 'url' || 'commandline'
                ? ''
                : 'none';
        geoHelperCommand.settingEl.style.display =
            this.plugin.settings.geoHelperType === 'commandline' ? '' : 'none';

        new Setting(containerEl).setHeading().setName('高级');

        new Setting(containerEl)
            .setName('调试日志（高级）')
            .addToggle((component) => {
                component
                    .setValue(
                        this.plugin.settings.debug != null
                            ? this.plugin.settings.debug
                            : DEFAULT_SETTINGS.debug,
                    )
                    .onChange(async (value) => {
                        this.plugin.settings.debug = value;
                        await this.plugin.saveSettings();
                    });
            });
    }

    hide() {
        if (this.refreshPluginOnHide) {
            const mapView = this.findMapView();
            if (mapView) mapView.mapContainer.refreshMap();
        }
    }

    findMapView() {
        const mapViews = this.app.workspace.getLeavesOfType(
            consts.MAP_VIEW_NAME,
        );
        for (const leaf of mapViews) {
            if (leaf.view) return leaf.view as BaseMapView;
        }
        return null;
    }

    refreshMapSourceSettings(containerEl: HTMLElement) {
        containerEl.innerHTML = '';
        for (const setting of this.plugin.settings.mapSources) {
            const controls = new Setting(containerEl)
                .addText((component) => {
                    component
                        .setPlaceholder('Name')
                        .setValue(setting.name)
                        .onChange(async (value: string) => {
                            setting.name = value;
                            this.refreshPluginOnHide = true;
                            await this.plugin.saveSettings();
                        }).inputEl.style.width = '10em';
                })
                .addText((component) => {
                    component
                        .setPlaceholder('URL (light/default)')
                        .setValue(setting.urlLight)
                        .onChange(async (value: string) => {
                            setting.urlLight = value;
                            this.refreshPluginOnHide = true;
                            await this.plugin.saveSettings();
                        });
                })
                .addText((component) => {
                    component
                        .setPlaceholder('URL (dark) (opt.)')
                        .setValue(setting.urlDark)
                        .onChange(async (value: string) => {
                            setting.urlDark = value;
                            this.refreshPluginOnHide = true;
                            await this.plugin.saveSettings();
                        }).inputEl.style.width = '10em';
                })
                .addText((component) => {
                    component
                        .setPlaceholder('Max Tile Zoom')
                        .setValue(
                            (
                                setting.maxZoom ?? DEFAULT_MAX_TILE_ZOOM
                            ).toString(),
                        )
                        .onChange(async (value: string) => {
                            let zoom = parseInt(value);
                            if (typeof zoom == 'number') {
                                zoom = Math.min(Math.max(0, zoom), MAX_ZOOM);
                                setting.maxZoom = zoom;
                                this.refreshPluginOnHide = true;
                                await this.plugin.saveSettings();
                            }
                        }).inputEl.style.width = '3em';
                });
            if (!setting.preset)
                controls.addButton((component) =>
                    component.setButtonText('Delete').onClick(async () => {
                        this.plugin.settings.mapSources.remove(setting);
                        this.refreshPluginOnHide = true;
                        await this.plugin.saveSettings();
                        this.refreshMapSourceSettings(containerEl);
                    }),
                );
            controls.settingEl.style.padding = '5px';
            controls.settingEl.style.borderTop = 'none';
        }
    }

    refreshOpenInSettings(containerEl: HTMLElement) {
        containerEl.innerHTML = '';
        for (const setting of this.plugin.settings.openIn) {
            const controls = new Setting(containerEl)
                .addText((component) => {
                    component
                        .setPlaceholder('Name')
                        .setValue(setting.name)
                        .onChange(async (value: string) => {
                            setting.name = value;
                            await this.plugin.saveSettings();
                        });
                })
                .addText((component) => {
                    component
                        .setPlaceholder('URL template')
                        .setValue(setting.urlPattern)
                        .onChange(async (value: string) => {
                            setting.urlPattern = value;
                            await this.plugin.saveSettings();
                        });
                })
                .addButton((component) =>
                    component.setButtonText('Delete').onClick(async () => {
                        this.plugin.settings.openIn.remove(setting);
                        await this.plugin.saveSettings();
                        this.refreshOpenInSettings(containerEl);
                    }),
                );
            controls.settingEl.style.padding = '5px';
            controls.settingEl.style.borderTop = 'none';
        }
    }

    refreshUrlParsingRules(containerEl: HTMLElement) {
        containerEl.innerHTML = '';
        const parsingRules = this.plugin.settings.urlParsingRules;
        // Make sure that the default settings are included. That's because I'll want to add more parsing
        // rules in the future, and I want existing users to receive them
        for (const defaultSetting of DEFAULT_SETTINGS.urlParsingRules)
            if (
                parsingRules.findIndex(
                    (rule) => rule.name === defaultSetting.name,
                ) === -1
            ) {
                parsingRules.push(defaultSetting);
                this.plugin.saveSettings();
            }
        for (const setting of parsingRules) {
            const parsingRuleDiv = containerEl.createDiv('parsing-rule');
            const line1 = parsingRuleDiv.createDiv('parsing-rule-line-1');
            let line2: HTMLDivElement = null;
            let adjustToRuleType = (ruleType: UrlParsingRuleType) => {
                text.setPlaceholder(
                    ruleType === 'fetch'
                        ? 'Regex with 1 capture group'
                        : 'Regex with 2 capture groups',
                );
                if (line2)
                    line2.style.display =
                        ruleType === 'fetch' ? 'block' : 'none';
            };
            const controls = new Setting(line1).addText((component) => {
                component
                    .setPlaceholder('Name')
                    .setValue(setting.name)
                    .onChange(async (value: string) => {
                        setting.name = value;
                        await this.plugin.saveSettings();
                    });
            });
            const text = new TextComponent(controls.controlEl);
            text.setValue(setting.regExp).onChange(async (value: string) => {
                setting.regExp = value;
                await this.plugin.saveSettings();
            });
            controls.addDropdown((component) =>
                component
                    .addOption('latLng', '(lat)(lng)')
                    .addOption('lngLat', '(lng)(lat)')
                    .addOption('fetch', 'fetch')
                    .setValue(setting.ruleType ?? 'latLng')
                    .onChange(async (value: UrlParsingRuleType) => {
                        setting.ruleType = value;
                        adjustToRuleType(value);
                        await this.plugin.saveSettings();
                    })
                    .selectEl.addClass('url-rule-dropdown'),
            );
            controls.settingEl.style.padding = '0px';
            controls.settingEl.style.borderTop = 'none';
            if (!setting.preset)
                controls.addButton((component) =>
                    component.setButtonText('Delete').onClick(async () => {
                        this.plugin.settings.urlParsingRules.remove(setting);
                        await this.plugin.saveSettings();
                        this.refreshUrlParsingRules(containerEl);
                    }),
                );
            line2 = parsingRuleDiv.createDiv('parsing-rule-line-2');
            adjustToRuleType(setting.ruleType);
            const contentLabel = line2.createEl('label');
            contentLabel.setText('Content parsing expression:');
            contentLabel.style.paddingRight = '10px';
            new TextComponent(line2)
                .setPlaceholder('Regex with 1-2 capture groups')
                .setValue(setting.contentParsingRegExp)
                .onChange(async (value) => {
                    setting.contentParsingRegExp = value;
                    await this.plugin.saveSettings();
                });
            new DropdownComponent(line2)
                .addOption('latLng', '(lat)(lng)')
                .addOption('lngLat', '(lng)(lat)')
                .addOption('googlePlace', '(google-place)')
                .setValue(setting.contentType ?? 'latLng')
                .onChange(async (value) => {
                    setting.contentType = value as UrlParsingContentType;
                    await this.plugin.saveSettings();
                });
        }
    }
}
