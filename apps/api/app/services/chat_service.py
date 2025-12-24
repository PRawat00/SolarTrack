"""
Chat service for natural language queries on solar data.

Uses Gemini to:
1. Generate SQL from natural language
2. Determine appropriate chart configuration for results
"""

import json
import re
from typing import Any
from google import genai
from pydantic import BaseModel

from app.config import settings


# SQL Generation Prompt (PostgreSQL - default for production)
SQL_PROMPT = """You are a SQL query generator for a solar panel tracking database.

DATABASE SCHEMA:
Table: solar_readings
- reading_date (DATE): Date of the reading
- m1 (DECIMAL): First meter reading in kWh (cumulative)
- m2 (DECIMAL): Second meter reading in kWh (cumulative)
- temp_max (DECIMAL): Maximum temperature in Celsius
- sunshine_hours (DECIMAL): Hours of sunshine
- radiation_sum (DECIMAL): Solar radiation in MJ/m2
- snowfall (DECIMAL): Snowfall in cm
- weather_code (INTEGER): WMO weather code
- notes (TEXT): Optional notes

CALCULATION NOTES:
- Daily production = current m2 - previous m2 (use LAG function)
- For simple queries, just use m2 directly as an approximation
- Money saved = production * cost_per_kwh (use 0.15 as default)
- CO2 offset = production * co2_factor (use 0.85 as default)

RULES:
1. Generate PostgreSQL-compatible SELECT queries only
2. Do NOT include user_id filter (it will be added automatically)
3. Return ONLY the raw SQL query, no markdown, no explanation
4. Use appropriate date functions for time periods (CURRENT_DATE, INTERVAL, etc.)
5. Always order by reading_date when returning time series
6. Limit results to 365 rows maximum for performance
7. For "this month" use: reading_date >= DATE_TRUNC('month', CURRENT_DATE)
8. For "last N days" use: reading_date >= CURRENT_DATE - INTERVAL 'N days'
9. For "this year" use: EXTRACT(YEAR FROM reading_date) = EXTRACT(YEAR FROM CURRENT_DATE)

USER QUESTION: {question}
"""

# Chart Configuration Prompt
CHART_PROMPT = """Given the following data and user question, determine the best visualization.

USER QUESTION: {question}

DATA COLUMNS: {columns}
DATA SAMPLE (first 5 rows): {sample}
TOTAL ROWS: {total_rows}

Return a JSON object with one of these formats:

For time series data (line/area chart):
{{
  "answer": "Natural language summary of the findings",
  "type": "line",
  "xKey": "column name for x-axis (usually a date)",
  "series": [
    {{"dataKey": "column_name", "name": "Display Name", "color": "#22c55e"}}
  ],
  "xLabel": "X axis label",
  "yLabel": "Y axis label"
}}

For comparisons (bar chart):
{{
  "answer": "Natural language summary",
  "type": "bar",
  "xKey": "category column",
  "series": [
    {{"dataKey": "value_column", "name": "Display Name", "color": "#3b82f6"}}
  ],
  "xLabel": "Category",
  "yLabel": "Value"
}}

For single-value answers:
{{
  "answer": "Your total production this month was 245.5 kWh",
  "type": "stat",
  "value": 245.5,
  "label": "Total Production",
  "unit": "kWh"
}}

For tabular data:
{{
  "answer": "Here are the details",
  "type": "table"
}}

COLOR PALETTE (use these in order):
- Green: #22c55e (primary data)
- Blue: #3b82f6 (secondary)
- Amber: #f59e0b (weather data)
- Purple: #8b5cf6 (comparisons)

Return ONLY valid JSON, no markdown code blocks.
"""


class ChartSeries(BaseModel):
    """A single series in a chart."""
    dataKey: str
    name: str
    color: str = "#22c55e"
    yAxisId: str | None = None


class ChartConfig(BaseModel):
    """Configuration for rendering a chart."""
    answer: str
    type: str  # line, bar, area, pie, stat, table
    xKey: str | None = None
    series: list[ChartSeries] | None = None
    xLabel: str | None = None
    yLabel: str | None = None
    yLabelRight: str | None = None
    # For stat type
    value: float | None = None
    label: str | None = None
    unit: str | None = None


class ChatResponse(BaseModel):
    """Response from chat query."""
    answer: str
    data: list[dict[str, Any]]
    chart: ChartConfig | None = None
    sql: str | None = None  # For debugging
    error: str | None = None


class ChatService:
    """Service for handling natural language queries on solar data."""

    # Dangerous SQL patterns to block
    DANGEROUS_PATTERNS = [
        r'\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|REPLACE)\b',
        r'\b(GRANT|REVOKE|EXEC|EXECUTE)\b',
        r'\b(INTO\s+OUTFILE|LOAD_FILE|LOAD\s+DATA)\b',
        r';\s*\w',  # Multiple statements
        r'--',  # SQL comments (potential injection)
        r'/\*',  # Block comments
    ]

    # Allowed tables
    ALLOWED_TABLES = ['solar_readings', 'user_settings']

    def __init__(self):
        if not settings.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY not configured")
        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)

    async def generate_sql(self, question: str) -> str:
        """Generate SQL from natural language question."""
        prompt = SQL_PROMPT.format(question=question)

        response = await self.client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=[prompt],
        )

        sql = response.text.strip()

        # Remove markdown code blocks if present
        if sql.startswith("```"):
            lines = sql.split("\n")
            sql = "\n".join(lines[1:-1])
            if sql.startswith("sql"):
                sql = sql[3:].strip()

        return sql

    def validate_sql(self, sql: str) -> tuple[bool, str | None]:
        """
        Validate SQL for security.

        Returns (is_valid, error_message).
        """
        sql_upper = sql.upper()

        # Must be a SELECT query
        if not sql_upper.strip().startswith("SELECT"):
            return False, "Only SELECT queries are allowed"

        # Check for dangerous patterns
        for pattern in self.DANGEROUS_PATTERNS:
            if re.search(pattern, sql, re.IGNORECASE):
                return False, f"Query contains forbidden pattern"

        # Check for allowed tables only
        # Simple check - look for FROM and JOIN clauses
        tables_in_query = re.findall(
            r'\b(?:FROM|JOIN)\s+(\w+)', sql, re.IGNORECASE
        )
        for table in tables_in_query:
            if table.lower() not in self.ALLOWED_TABLES:
                return False, f"Access to table '{table}' is not allowed"

        return True, None

    def inject_user_filter(self, sql: str, user_id: str) -> str:
        """Inject user_id filter into the SQL query."""
        # Find WHERE clause or add one
        sql_upper = sql.upper()

        if "WHERE" in sql_upper:
            # Add to existing WHERE
            where_pos = sql_upper.index("WHERE")
            before = sql[:where_pos + 5]
            after = sql[where_pos + 5:]
            return f"{before} user_id = '{user_id}' AND {after}"
        else:
            # Find position to insert WHERE (before GROUP BY, ORDER BY, LIMIT, or end)
            insert_keywords = ["GROUP BY", "ORDER BY", "LIMIT", ";"]
            insert_pos = len(sql)

            for keyword in insert_keywords:
                pos = sql_upper.find(keyword)
                if pos != -1 and pos < insert_pos:
                    insert_pos = pos

            before = sql[:insert_pos].rstrip()
            after = sql[insert_pos:]
            return f"{before} WHERE user_id = '{user_id}' {after}"

    async def generate_chart_config(
        self,
        question: str,
        data: list[dict[str, Any]],
    ) -> ChartConfig:
        """Generate chart configuration based on data and question."""
        if not data:
            return ChartConfig(
                answer="No data found for your query.",
                type="stat",
                value=0,
                label="No Results",
                unit=""
            )

        columns = list(data[0].keys())
        sample = data[:5]

        prompt = CHART_PROMPT.format(
            question=question,
            columns=columns,
            sample=json.dumps(sample, default=str),
            total_rows=len(data)
        )

        response = await self.client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=[prompt],
        )

        text = response.text.strip()

        # Remove markdown code blocks if present
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1])
            if text.startswith("json"):
                text = text[4:].strip()

        try:
            config_data = json.loads(text)
            return ChartConfig(**config_data)
        except (json.JSONDecodeError, Exception) as e:
            # Fallback to table view
            return ChartConfig(
                answer=f"Here are the results for: {question}",
                type="table"
            )

    async def query(
        self,
        question: str,
        user_id: str,
        db_session,
    ) -> ChatResponse:
        """
        Process a natural language query.

        Args:
            question: Natural language question
            user_id: User ID for data filtering
            db_session: SQLAlchemy database session

        Returns:
            ChatResponse with answer, data, and chart configuration
        """
        from sqlalchemy import text

        try:
            # Generate SQL
            sql = await self.generate_sql(question)

            # Validate SQL
            is_valid, error = self.validate_sql(sql)
            if not is_valid:
                return ChatResponse(
                    answer=f"I couldn't process that query safely: {error}",
                    data=[],
                    error=error
                )

            # Inject user filter
            sql_with_user = self.inject_user_filter(sql, user_id)

            # Execute query
            try:
                result = db_session.execute(text(sql_with_user))
                rows = result.fetchall()
                columns = result.keys()

                # Convert to list of dicts
                data = [dict(zip(columns, row)) for row in rows]

                # Handle date serialization
                for row in data:
                    for key, value in row.items():
                        if hasattr(value, 'isoformat'):
                            row[key] = value.isoformat()
                        elif hasattr(value, '__float__'):
                            row[key] = float(value)

            except Exception as e:
                return ChatResponse(
                    answer=f"Error executing query: {str(e)}",
                    data=[],
                    sql=sql_with_user,
                    error=str(e)
                )

            # Generate chart configuration
            chart_config = await self.generate_chart_config(question, data)

            return ChatResponse(
                answer=chart_config.answer,
                data=data,
                chart=chart_config,
                sql=sql_with_user
            )

        except Exception as e:
            return ChatResponse(
                answer=f"Sorry, I encountered an error: {str(e)}",
                data=[],
                error=str(e)
            )
