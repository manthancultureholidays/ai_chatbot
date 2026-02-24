const fs = require('fs');
const path = require('path');

const destinations = [
    "Paris, France", "Tokyo, Japan", "New York, USA", "Rome, Italy", "Bali, Indonesia",
    "Santorini, Greece", "Cairo, Egypt", "Sydney, Australia", "Cape Town, South Africa", "Machu Picchu, Peru",
    "London, UK", "Barcelona, Spain", "Dubai, UAE", "Bangkok, Thailand", "Reykjavik, Iceland",
    "Delhi, India", "Jaipur, India", "Mumbai, India", "Goa, India", "Agra, India"
];

const hotelCategories = ["3 Star", "4 Star", "5 Star", "Boutique", "Luxury Resort"];
const roomCategories = ["Standard", "Deluxe", "Executive", "Suite", "Ocean View"];

function generateData() {
    const data = {
        countries: [
            { id: 1, name: "India", code: "IN" },
            { id: 2, name: "United Arab Emirates", code: "UAE" },
            { id: 3, name: "France", code: "FR" },
            { id: 4, name: "Japan", code: "JP" },
            { id: 5, name: "USA", code: "US" }
        ],
        packages: [],
        package_rates: [],
        itinerary: []
    };

    let pkgIdCounter = 1001;
    let rateIdCounter = 1;
    let itinIdCounter = 1;

    for (let i = 0; i < 1000; i++) {
        const dest = destinations[Math.floor(Math.random() * destinations.length)];
        const nights = Math.floor(Math.random() * 7) + 3;
        const pkgId = pkgIdCounter++;

        data.packages.push({
            id: pkgId,
            title: `${dest} Adventure #${i + 1}`,
            nights: nights,
            description: `Explore the wonders of ${dest} in this ${nights}-day journey. Enjoy local culture, food, and sightseeing.`,
            country_code: dest.split(', ')[1] || "Global",
            destination: dest.split(', ')[0],
            status: "Active"
        });

        // Generate 2 rates per package
        for (let j = 0; j < 2; j++) {
            const hCat = hotelCategories[Math.floor(Math.random() * hotelCategories.length)];
            const rCat = roomCategories[Math.floor(Math.random() * roomCategories.length)];
            const basePrice = Math.floor(Math.random() * 1000) + 500;

            data.package_rates.push({
                package_id: pkgId,
                hotel_category: hCat,
                room_category: rCat,
                double_bed: true,
                agent_price_dbl: basePrice,
                client_price_dbl: basePrice + 200,
                available_date: "2024-11-01",
                single_agent_price: basePrice - 50,
                single_client_price: basePrice + 150
            });
        }

        // Generate itinerary
        for (let day = 1; day <= nights; day++) {
            data.itinerary.push({
                id: itinIdCounter++,
                package_id: pkgId,
                day: day,
                title: `Day ${day} in ${dest.split(', ')[0]}`,
                desc: `Enjoy activity ${day} which includes local attractions and guided tours.`,
                activity_id: Math.floor(Math.random() * 1000) + 1,
                city_name: dest.split(', ')[0]
            });
        }
    }

    const outputPath = path.join(__dirname, '..', 'data', 'db.json');
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    console.log(`Generated 1000 packages at ${outputPath}`);
}

generateData();
