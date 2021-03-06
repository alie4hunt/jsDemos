const idPrefix = 'queIt_';

(async () => {
	const {tslReminders : data = {}, migrated = false} =  await browser.storage.local.get() || {};
	if (migrated) return;
	Object.keys(data).forEach(id => {
		if (typeof data[id] !== 'string') return;
		try {
			const formatDate = d => {
				const year = tsDate.getFullYear();
				const month = (tsDate.getMonth() + 1).toString().padStart(2,0);
				const dateN = (tsDate.getDate()).toString().padStart(2,0);
				return `${year}-${month}-${dateN}`;
			}
			const ts = id.split(idPrefix)[1];
			const tsDate = new Date(ts*1);
			const rDate = formatDate(tsDate);
			const rTime = `${tsDate.getHours()}:${tsDate.getMinutes()}`;
			const newData =  {
				title: data[id],
				desc: '',
				daily: false,
				id,
				ts,
				rDate,
				rTime
			}
			data[id] = newData;
		}catch(e){}
	});
	await browser.storage.local.set({ tslReminders: data, migrated: true })
})();

const handleMessage = async ({ action, data = {} }) => {

	const createTimestamp = ({ rDate = '', rTime }) => {
		let dateArr = [];
		if (rDate == '') {
			const today = new Date;
			dateArr[0] = today.getFullYear();
			dateArr[1] = today.getMonth() + 1;
			dateArr[2] = today.getDate();
		} else {
			dateArr = rDate.split('-');
		}

		const timeArr = rTime.split(':');
		let aDate = new Date(dateArr[0], dateArr[1] - 1, dateArr[2], timeArr[0], timeArr[1] || 0);
		const rn = new Date();
		if (rn > aDate) {
			aDate.setDate(aDate.getDate() + 1);
		}
		return aDate.getTime();
	}

	const createAlarm = ({ ts: when, daily }, id) => {
		const info = { when };
		if (daily) info.periodInMinutes = 1440;
		browser.alarms.create(id, info)
	}

	const gettingItem = browser.storage.local.get('tslReminders');

	switch (action) {
		case 'create':
			const ts = createTimestamp(data)
			const id = (data.id && data.id !== '') ? data.id : `${idPrefix}${ts}`;
			data.id = id;
			data.ts = ts;
			gettingItem.then((res) => {
				const newReminders = res.tslReminders
				newReminders[id] = data;
				browser.storage.local.set({ tslReminders: newReminders })
					.then(() => browser.runtime.sendMessage({
						action: 'create'
					}));
				createAlarm(data, id)
			}).catch(() => {
				browser.storage.local.set({ tslReminders: { [id]: data } })
				createAlarm(data, id)
			});
			break;
		case 'list':
			gettingItem.then((res) => {
				const { tslReminders: reminders = {} } = res;
				browser.runtime.sendMessage({
					action: 'list',
					data: reminders,
					current: data.current
				});
			}).catch(() => {
				browser.runtime.sendMessage({
					action: 'list',
					data: {},
					current: data.current
				});
			});
			break;
		case 'getreminder':
			gettingItem.then((res) => {
				const { tslReminders: reminders = {} } = res;
				browser.runtime.sendMessage({
					action: 'getreminder',
					data: reminders[data.id],
				});
			})
			break;
		case 'delete':
			gettingItem.then((res) => {
				const { tslReminders: reminders = {} } = res;
				browser.alarms.clear(data.id);
				delete reminders[data.id];
				browser.storage.local.set({ tslReminders: reminders })
				browser.runtime.sendMessage({
					action: 'list',
					data: reminders,
					current: data.current
				});
			});
			break;
	}
}

browser.runtime.onMessage.addListener(handleMessage);

const createNotification = info => {
	browser.notifications.create(info);
}
browser.alarms.onAlarm.addListener((alarm) => {
	const gettingItem = browser.storage.local.get('tslReminders');
	gettingItem.then(({ tslReminders }) => {
		let reminder = tslReminders[alarm.name] || {};
		if (typeof reminder === 'string') {
			reminder = {
				title: 'Reminder',
				desc: reminder
			}
		}
		const info = {
			type: "basic",
			iconUrl: "icons/logo_64.png",
			title: reminder.title || "Reminder",
			message: reminder.desc || 'PING'
		}
		createNotification(info);
		if (!reminder.daily) tslReminders[alarm.name].done = true;
		browser.storage.local.set({ tslReminders });
	});
});
