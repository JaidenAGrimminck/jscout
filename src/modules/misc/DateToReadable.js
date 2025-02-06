

export default function DateToReadable(date) {
    const dateObj = new Date(date);

    const month = dateObj.toLocaleString('default', { month: 'long' });
    const day = dateObj.getDate();
    const year = dateObj.getFullYear();

    const daysuffix = (day) => {
        if (day === 1 || day === 21 || day === 31) return 'st';
        if (day === 2 || day === 22) return 'nd';
        if (day === 3 || day === 23) return 'rd';
        return 'th';
    }

    return `${month} ${day}${daysuffix(day)}, ${year}`;
}