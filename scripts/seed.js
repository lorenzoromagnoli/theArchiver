const sqlite3 = require('sqlite3').verbose();
const path = require('path');

console.log('🌱 Seeding Team Creative Archive with sample data...');

const dbPath = path.join(__dirname, '..', 'team_archive.db');
const db = new sqlite3.Database(dbPath);

const sampleItems = [
    {
        title: "Minimalist Design Inspiration",
        description: "Clean and modern design patterns for web interfaces. Focus on whitespace and typography for better user experience.",
        url: "https://dribbble.com/shots/minimalist",
        tags: "design,minimalism,ui,inspiration,typography",
        collection: "Inspiration",
        created_by: 2
    },
    {
        title: "Color Psychology in UX Design",
        description: "Research on how colors affect user behavior and decision making in digital products. Essential reading for designers.",
        url: "https://www.nngroup.com/articles/color-psychology/",
        tags: "psychology,colors,ux,research,behavior",
        collection: "Research",
        created_by: 2
    },
    {
        title: "Typography Guidelines 2024",
        description: "Best practices for readable and accessible typography in digital design. Includes font pairing recommendations.",
        url: "",
        tags: "typography,accessibility,guidelines,fonts",
        collection: "Design",
        created_by: 1
    },
    {
        title: "Design System Components Library",
        description: "Comprehensive collection of reusable components and patterns for consistent user interfaces across products.",
        url: "https://design-system.service.gov.uk/",
        tags: "design-system,components,ui,library,patterns",
        collection: "Resources",
        created_by: 1
    },
    {
        title: "Mobile-First Design Strategies",
        description: "Strategic approaches to designing for mobile devices first, then scaling up to larger screens.",
        url: "https://www.smashingmagazine.com/mobile-first/",
        tags: "mobile,responsive,strategy,design",
        collection: "Inspiration",
        created_by: 2
    },
    {
        title: "User Research Methods Comparison",
        description: "Detailed comparison of different user research methods and when to use each one effectively.",
        url: "",
        tags: "user-research,methods,comparison,ux",
        collection: "Research",
        created_by: 1
    },
    {
        title: "CSS Grid Layout Examples",
        description: "Practical examples and code snippets for creating complex layouts using CSS Grid.",
        url: "https://gridbyexample.com/",
        tags: "css,grid,layout,examples,code",
        collection: "Resources",
        created_by: 2
    },
    {
        title: "Accessibility Checklist",
        description: "Comprehensive checklist for ensuring your designs meet accessibility standards and guidelines.",
        url: "https://webaim.org/checklist/",
        tags: "accessibility,checklist,standards,inclusive",
        collection: "Resources",
        created_by: 1
    },
    {
        title: "Dark Mode Design Principles",
        description: "Guidelines and best practices for implementing dark mode in user interfaces effectively.",
        url: "",
        tags: "dark-mode,design,principles,ui",
        collection: "Design",
        created_by: 2
    },
    {
        title: "Micro-Interactions in UX",
        description: "How small interactive details can enhance user experience and provide valuable feedback.",
        url: "https://uxdesign.cc/micro-interactions/",
        tags: "micro-interactions,ux,animation,feedback",
        collection: "Inspiration",
        created_by: 1
    }
];

async function seedDatabase() {
    try {
        console.log('📊 Adding sample archive items...');
        
        for (const item of sampleItems) {
            // Get collection ID
            const collection = await getQuery('SELECT id FROM collections WHERE name = ?', [item.collection]);
            
            if (collection) {
                await runQuery(
                    `INSERT INTO archive_items (title, description, url, tags, collection_id, created_by, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-' || ? || ' days'))`,
                    [
                        item.title, 
                        item.description, 
                        item.url, 
                        item.tags, 
                        collection.id, 
                        item.created_by,
                        Math.floor(Math.random() * 30) // Random days ago (0-30)
                    ]
                );
                console.log(`  ✅ Added: ${item.title}`);
            } else {
                console.log(`  ❌ Collection not found: ${item.collection}`);
            }
        }
        
        console.log('');
        console.log('🎉 Database seeded successfully!');
        console.log(`📈 Added ${sampleItems.length} sample items across all collections`);
        console.log('');
        console.log('🚀 Your archive is ready! Start the server with: npm start');
        console.log('');
        console.log('💡 Sample content includes:');
        console.log('   • Design inspiration and trends');
        console.log('   • UX research and psychology');
        console.log('   • Development resources and tools');
        console.log('   • Accessibility guidelines');
        console.log('   • Best practices and methodologies');

    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    } finally {
        db.close((err) => {
            if (err) {
                console.error('Error closing database:', err);
            } else {
                console.log('Database connection closed.');
            }
        });
    }
}

function runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this);
            }
        });
    });
}

function getQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

// Run seeding
seedDatabase();