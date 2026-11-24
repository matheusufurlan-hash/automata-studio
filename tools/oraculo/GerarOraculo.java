/*
 * Oráculo de testes do núcleo de Autômatos Finitos do Autômatos Studio.
 *
 * Roda os algoritmos do YAAS ORIGINAL (Prof. Dr. David Buzatto, GPL v3) em
 * cada exemplo e grava os resultados em src/core/fa/__fixtures__/oraculo.json.
 * Os testes em TypeScript (src/core/fa/oraculo.test.ts) comparam a nossa
 * implementação com esse arquivo.
 *
 * Como rodar (de dentro de tools/oraculo):
 *
 *   javac -cp ~/Downloads/YAAS-1.0.7.jar -d /tmp/oraculo GerarOraculo.java
 *   java -Djava.awt.headless=true -cp ~/Downloads/YAAS-1.0.7.jar:/tmp/oraculo \
 *        GerarOraculo ../../src/core/fa/__fixtures__/oraculo.json
 *
 * O que é gravado para cada exemplo:
 *   - type: o tipo segundo o YAAS (DFA / NFA / ENFA);
 *   - structure: estados (nome, posição, inicial, final) e transições, para
 *     conferir que src/core/fa/examples.ts é uma cópia fiel do exemplo;
 *   - accepted: palavras aceitas de tamanho 0 até maxLength sobre o alfabeto;
 *   - determinize: nº de estados do AFD do YAAS (que NUNCA cria o estado ∅) e
 *     o nº "com ∅" (+1 se o AFD do YAAS é parcial em relação a Σ);
 *   - minimize: nº de estados do mínimo do YAAS (que remove estados inúteis,
 *     então o resultado é parcial) e o nº "com estado morto" (+1 se parcial);
 *   - complement: palavras aceitas pelo complemento do YAAS;
 *   - removeUseless: nomes dos estados que sobram depois de remover
 *     inalcançáveis e inúteis.
 *
 * Linguagens ("accepted", "complement", operações): para cada tamanho, a
 * quantidade de palavras aceitas e o SHA-256 da lista ordenada (ordem de
 * String.compareTo, ou seja, por unidade UTF-16) juntada com "\n". Se o total
 * for pequeno, a lista explícita também vai em "words" (ajuda a depurar).
 * O tamanho máximo é 6, mas cai quando o alfabeto é grande (ex.: 13 símbolos
 * do número decimal), para que Σ^0 ∪ ... ∪ Σ^maxLength tenha no máximo
 * MAX_UNIVERSE palavras.
 */

import br.com.davidbuzatto.yaas.model.fa.FA;
import br.com.davidbuzatto.yaas.model.fa.FAState;
import br.com.davidbuzatto.yaas.model.fa.FATransition;
import br.com.davidbuzatto.yaas.model.fa.FAType;
import br.com.davidbuzatto.yaas.model.fa.algorithms.DFAComplement;
import br.com.davidbuzatto.yaas.model.fa.algorithms.DFAMinimize;
import br.com.davidbuzatto.yaas.model.fa.algorithms.FACommon;
import br.com.davidbuzatto.yaas.model.fa.algorithms.FAConcatenation;
import br.com.davidbuzatto.yaas.model.fa.algorithms.FADeterminize;
import br.com.davidbuzatto.yaas.model.fa.algorithms.FAIntersection;
import br.com.davidbuzatto.yaas.model.fa.algorithms.FAKleeneStar;
import br.com.davidbuzatto.yaas.model.fa.algorithms.FARemoveInaccessibleAndUselessStates;
import br.com.davidbuzatto.yaas.model.fa.algorithms.FAUnion;
import br.com.davidbuzatto.yaas.model.fa.examples.FAExamples;
import br.com.davidbuzatto.yaas.model.fa.examples.FAExamplesForMinimizationTest;
import br.com.davidbuzatto.yaas.model.fa.examples.FAExamplesForRemoveUselessAndInaccessibleStates;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.function.Supplier;

public class GerarOraculo {

    static final int MAX_LENGTH = 6;
    static final long MAX_UNIVERSE = 50_000;
    static final int MAX_EXPLICIT_WORDS = 1_000;

    record Example( String id, String source, Supplier<FA> factory ) {}

    /** Os ids precisam ser os mesmos de src/core/fa/examples.ts. */
    static final List<Example> EXAMPLES = List.of(
        new Example( "afd-contem-01", "FAExamples.createDFASubstring01", FAExamples::createDFASubstring01 ),
        new Example( "afd-termina-00", "FAExamples.createDFAEndsWith00", FAExamples::createDFAEndsWith00 ),
        new Example( "afd-termina-01", "FAExamples.createDFAEndsWith01", FAExamples::createDFAEndsWith01 ),
        new Example( "afd-termina-10", "FAExamples.createDFAEndsWith10", FAExamples::createDFAEndsWith10 ),
        new Example( "afd-termina-11", "FAExamples.createDFAEndsWith11", FAExamples::createDFAEndsWith11 ),
        new Example( "afd-0-par-ou-1-impar", "FAExamples.createDFA0Even1Odd", FAExamples::createDFA0Even1Odd ),
        new Example( "afn-termina-00", "FAExamples.createNFAEndsWith00", FAExamples::createNFAEndsWith00 ),
        new Example( "afn-termina-01", "FAExamples.createNFAEndsWith01", FAExamples::createNFAEndsWith01 ),
        new Example( "afn-termina-10", "FAExamples.createNFAEndsWith10", FAExamples::createNFAEndsWith10 ),
        new Example( "afn-termina-11", "FAExamples.createNFAEndsWith11", FAExamples::createNFAEndsWith11 ),
        new Example( "enfa-numero-decimal", "FAExamples.createENFADecimalNumber", FAExamples::createENFADecimalNumber ),
        new Example( "afd-so-01", "FAExamples.createDFAForRejectionStep", FAExamples::createDFAForRejectionStep ),
        new Example( "afd-minimizacao-dois-grupos", "FAExamples.createDFAForMinimizationTwoGroups", FAExamples::createDFAForMinimizationTwoGroups ),
        new Example( "afd-minimizacao-parcial", "FAExamples.createDFAForMinimizationPartial", FAExamples::createDFAForMinimizationPartial ),
        new Example( "minimizacao-01", "FAExamplesForMinimizationTest.createDFAForMinimizationTest01", FAExamplesForMinimizationTest::createDFAForMinimizationTest01 ),
        new Example( "minimizacao-02", "FAExamplesForMinimizationTest.createDFAForMinimizationTest02", FAExamplesForMinimizationTest::createDFAForMinimizationTest02 ),
        new Example( "minimizacao-03", "FAExamplesForMinimizationTest.createDFAForMinimizationTest03", FAExamplesForMinimizationTest::createDFAForMinimizationTest03 ),
        new Example( "minimizacao-04", "FAExamplesForMinimizationTest.createDFAForMinimizationTest04", FAExamplesForMinimizationTest::createDFAForMinimizationTest04 ),
        new Example( "minimizacao-05", "FAExamplesForMinimizationTest.createDFAForMinimizationTest05", FAExamplesForMinimizationTest::createDFAForMinimizationTest05 ),
        new Example( "minimizacao-06", "FAExamplesForMinimizationTest.createDFAForMinimizationTest06", FAExamplesForMinimizationTest::createDFAForMinimizationTest06 ),
        new Example( "minimizacao-07", "FAExamplesForMinimizationTest.createDFAForMinimizationTest07", FAExamplesForMinimizationTest::createDFAForMinimizationTest07 ),
        new Example( "minimizacao-08", "FAExamplesForMinimizationTest.createDFAForMinimizationTest08", FAExamplesForMinimizationTest::createDFAForMinimizationTest08 ),
        new Example( "minimizacao-09", "FAExamplesForMinimizationTest.createDFAForMinimizationTest09", FAExamplesForMinimizationTest::createDFAForMinimizationTest09 ),
        new Example( "afn-estados-inuteis", "FAExamplesForRemoveUselessAndInaccessibleStates.createNFA", FAExamplesForRemoveUselessAndInaccessibleStates::createNFA )
    );

    /** Pares de exemplos para as operações (união, concatenação, interseção, estrela). */
    static final String[][] OPERATION_PAIRS = {
        { "afd-termina-01", "afn-termina-10" },
        { "afd-contem-01", "afd-0-par-ou-1-impar" },
        { "afd-contem-01", "afn-termina-10" },
        // alfabetos diferentes ({a,b} e {a,b,c}; 13 símbolos e {0,1})
        { "afd-minimizacao-parcial", "minimizacao-07" },
        { "enfa-numero-decimal", "afd-so-01" },
    };

    public static void main( String[] args ) throws Exception {

        Path out = Path.of( args.length > 0 ? args[0] : "oraculo.json" );

        Map<String, Object> root = new LinkedHashMap<>();
        root.put( "generator", "tools/oraculo/GerarOraculo.java" );
        root.put( "yaas", "YAAS-1.0.7.jar" );
        root.put( "hash", "sha256 das palavras aceitas de cada tamanho, ordenadas e juntadas com \\n" );

        List<Object> examples = new ArrayList<>();
        for ( Example e : EXAMPLES ) {
            examples.add( processExample( e ) );
            System.out.println( "ok: " + e.id() );
        }
        root.put( "examples", examples );

        List<Object> operations = new ArrayList<>();
        for ( String[] pair : OPERATION_PAIRS ) {
            operations.add( processPair( find( pair[0] ), find( pair[1] ) ) );
            System.out.println( "ok: " + pair[0] + " × " + pair[1] );
        }
        root.put( "operations", operations );

        StringBuilder sb = new StringBuilder();
        writeJson( root, sb, 0 );
        sb.append( '\n' );
        Files.createDirectories( out.toAbsolutePath().getParent() );
        Files.writeString( out, sb.toString(), StandardCharsets.UTF_8 );
        System.out.println( "gravado: " + out.toAbsolutePath() );

    }

    static Example find( String id ) {
        for ( Example e : EXAMPLES ) {
            if ( e.id().equals( id ) ) {
                return e;
            }
        }
        throw new IllegalArgumentException( "exemplo desconhecido: " + id );
    }

    static Map<String, Object> processExample( Example e ) throws Exception {

        FA fa = e.factory().get();
        fa.updateType();
        List<Character> sigma = new ArrayList<>( fa.getAlphabet() );
        int maxLength = maxLength( sigma.size() );

        Map<String, Object> r = new LinkedHashMap<>();
        r.put( "id", e.id() );
        r.put( "source", e.source() );
        r.put( "type", fa.getType().name() );
        r.put( "alphabet", charsToStrings( sigma ) );
        r.put( "maxLength", maxLength );
        r.put( "structure", structure( fa ) );
        r.put( "accepted", language( fa, sigma, maxLength ) );

        // determinização (o YAAS nunca cria o estado ∅)
        FA det = new FADeterminize( fa ).getGeneratedDFA();
        Map<String, Object> d = new LinkedHashMap<>();
        d.put( "states", det.getStates().size() );
        d.put( "statesWithEmptySet", det.getStates().size() + ( isPartial( det, sigma ) ? 1 : 0 ) );
        r.put( "determinize", d );

        // minimização e complemento trabalham sobre um AFD
        FA dfa = fa.getType() == FAType.DFA ? fa : det;

        FA min = new DFAMinimize( dfa, true ).getGeneratedDFA();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put( "states", min.getStates().size() );
        int withDead = min.getStates().isEmpty() ? 1
                : min.getStates().size() + ( isPartial( min, sigma ) ? 1 : 0 );
        m.put( "statesWithDeadState", withDead );
        r.put( "minimize", m );

        FA comp = new DFAComplement( dfa ).getGeneratedDFA();
        r.put( "complement", language( comp, sigma, maxLength ) );

        // remoção de inalcançáveis e inúteis: o YAAS renumera os estados, então
        // guardamos o nome original no rótulo antes de rodar
        FA labeled = e.factory().get();
        for ( FAState s : labeled.getStates() ) {
            s.setCustomLabel( s.toString() );
        }
        FA trimmed = new FARemoveInaccessibleAndUselessStates( labeled, true ).getGeneratedFA();
        List<String> kept = new ArrayList<>();
        for ( FAState s : trimmed.getStates() ) {
            kept.add( s.toString() );
        }
        r.put( "removeUseless", kept );

        return r;

    }

    static Map<String, Object> processPair( Example ea, Example eb ) throws Exception {

        FA a = ea.factory().get();
        FA b = eb.factory().get();
        a.updateType();
        b.updateType();

        Set<Character> union = new TreeSet<>( a.getAlphabet() );
        union.addAll( b.getAlphabet() );
        List<Character> sigma = new ArrayList<>( union );
        int maxLength = maxLength( sigma.size() );

        Map<String, Object> r = new LinkedHashMap<>();
        r.put( "a", ea.id() );
        r.put( "b", eb.id() );
        r.put( "alphabet", charsToStrings( sigma ) );
        r.put( "maxLength", maxLength );
        List<String> unionBugs = new ArrayList<>();
        Map<String, Object> unionLang = language( union( a, b, unionBugs ), sigma, maxLength );
        if ( !unionBugs.isEmpty() ) {
            unionLang.put( "yaasBug", unionBugs.get( 0 ) );
        }
        r.put( "union", unionLang );
        r.put( "concat", language( new FAConcatenation( a, b ).getGeneratedFA(), sigma, maxLength ) );
        r.put( "starA", language( new FAKleeneStar( a ).getGeneratedFA(), sigma, maxLength ) );
        r.put( "starB", language( new FAKleeneStar( b ).getGeneratedFA(), sigma, maxLength ) );

        // a interseção do YAAS exige dois AFDs
        FA da = a.getType() == FAType.DFA ? a : new FADeterminize( a ).getGeneratedDFA();
        FA db = b.getType() == FAType.DFA ? b : new FADeterminize( b ).getGeneratedDFA();
        Map<String, Object> inter;
        try {
            inter = language( new FAIntersection( da, db ).getGeneratedFA(), sigma, maxLength );
        } catch ( RuntimeException exc ) {
            // FAIntersection usa FAUnion por dentro e cai no mesmo bug; refazemos
            // os mesmos passos do FAIntersection.processIt com a união corrigida
            FA ca = new DFAComplement( da ).getGeneratedDFA();
            FA cb = new DFAComplement( db ).getGeneratedDFA();
            FA u = union( ca, cb, new ArrayList<>() );
            FA d = new FADeterminize( u ).getGeneratedDFA();
            FA c = new DFAComplement( d ).getGeneratedDFA();
            FA res = new FARemoveInaccessibleAndUselessStates( c, true ).getGeneratedFA();
            inter = language( res, sigma, maxLength );
            inter.put( "yaasBug", "FAIntersection lança " + exc.getClass().getSimpleName()
                    + " por causa do bug do FAUnion. Linguagem obtida refazendo "
                    + "complemento → união (corrigida) → determinização → complemento → remoção de inúteis." );
        }
        r.put( "intersection", inter );

        return r;

    }

    /**
     * União do YAAS, com o contorno de um BUG do YAAS 1.0.7 (FAUnion): depois
     * de setInitialState( null ), o merge chama addState, que marca o PRIMEIRO
     * estado do segundo autômato como inicial. Essa marca fica, o
     * reenumerateStates dá o número 0 para ele e para o novo inicial, e o
     * FA.accepts lança NullPointerException (o TreeMap do delta junta os dois
     * estados). Contorno, só para obter a linguagem: tirar a marca falsa e
     * renumerar.
     */
    static FA union( FA a, FA b, List<String> bugs ) {
        FA u = new FAUnion( a, b ).getGeneratedFA();
        int initials = 0;
        for ( FAState s : u.getStates() ) {
            if ( s.isInitial() ) {
                initials++;
            }
        }
        if ( initials > 1 ) {
            for ( FAState s : u.getStates() ) {
                if ( s != u.getInitialState() ) {
                    s.setInitial( false );
                }
            }
            FACommon.reenumerateStates( u );
            u.markAllCachesAsObsolete();
            bugs.add( "FAUnion deixa o 1º estado do 2º autômato marcado como inicial "
                    + "(FA.accepts lança NullPointerException). Linguagem obtida depois de tirar a marca falsa." );
        }
        return u;
    }

    /* ------------------------------------------------------------------ */

    static int maxLength( int k ) {
        int len = 0;
        long total = 1;
        long power = 1;
        while ( len < MAX_LENGTH ) {
            power *= Math.max( k, 1 );
            if ( total + power > MAX_UNIVERSE ) {
                break;
            }
            total += power;
            len++;
        }
        return len;
    }

    static Map<String, Object> language( FA fa, List<Character> sigma, int maxLength ) throws Exception {

        List<Integer> counts = new ArrayList<>();
        List<String> hashes = new ArrayList<>();
        List<String> all = new ArrayList<>();

        List<String> current = new ArrayList<>();
        current.add( "" );
        for ( int len = 0; len <= maxLength; len++ ) {
            if ( len > 0 ) {
                List<String> next = new ArrayList<>();
                for ( String w : current ) {
                    for ( char c : sigma ) {
                        next.add( w + c );
                    }
                }
                current = next;
            }
            List<String> accepted = new ArrayList<>();
            for ( String w : current ) {
                if ( fa.accepts( w ) ) {
                    accepted.add( w );
                }
            }
            Collections.sort( accepted );
            counts.add( accepted.size() );
            hashes.add( sha256( String.join( "\n", accepted ) ) );
            all.addAll( accepted );
        }

        Map<String, Object> r = new LinkedHashMap<>();
        r.put( "counts", counts );
        r.put( "sha256", hashes );
        if ( all.size() <= MAX_EXPLICIT_WORDS ) {
            r.put( "words", all );
        }
        return r;

    }

    /** true se falta alguma transição (estado, símbolo de sigma) no AFD. */
    static boolean isPartial( FA dfa, List<Character> sigma ) {
        Map<FAState, Map<Character, List<FAState>>> delta = dfa.getDelta();
        for ( FAState s : dfa.getStates() ) {
            Map<Character, List<FAState>> t = delta.get( s );
            for ( char c : sigma ) {
                List<FAState> targets = t.get( c );
                if ( targets == null || targets.isEmpty() ) {
                    return true;
                }
            }
        }
        return false;
    }

    static Map<String, Object> structure( FA fa ) throws Exception {

        List<FAState> states = fa.getStates();
        List<Object> ss = new ArrayList<>();
        for ( FAState s : states ) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put( "name", s.toString() );
            m.put( "number", s.getNumber() );
            m.put( "x", s.getX1() );
            m.put( "y", s.getY1() );
            m.put( "initial", s.isInitial() );
            m.put( "final", s.isFinal() );
            ss.add( m );
        }

        Field centralField = FATransition.class.getDeclaredField( "centralCP" );
        centralField.setAccessible( true );
        Field angleField = FATransition.class.getDeclaredField( "targetCPAngle" );
        angleField.setAccessible( true );

        List<Object> ts = new ArrayList<>();
        for ( FATransition t : fa.getTransitions() ) {
            Map<String, Object> m = new LinkedHashMap<>();
            FAState from = t.getOriginState();
            FAState to = t.getTargetState();
            m.put( "from", states.indexOf( from ) );
            m.put( "to", states.indexOf( to ) );
            m.put( "symbols", charsToStrings( t.getSymbols() ) );
            if ( from == to ) {
                // laço: ângulo em graus (0 = em cima, positivo = sentido horário na tela)
                double angle = (double) angleField.get( t );
                m.put( "loopAngle", (int) Math.round( Math.toDegrees( angle ) ) );
            } else {
                // curva: deslocamento do ponto do meio da curva em relação ao meio
                // da reta entre os centros, dividido pelo comprimento da reta.
                // positivo = curva para a esquerda de quem anda de "from" para "to"
                Object cp = centralField.get( t );
                int cx = (int) cp.getClass().getMethod( "getX1" ).invoke( cp );
                int cy = (int) cp.getClass().getMethod( "getY1" ).invoke( cp );
                double dx = to.getX1() - from.getX1();
                double dy = to.getY1() - from.getY1();
                double len = Math.hypot( dx, dy );
                double mx = cx - ( from.getX1() + to.getX1() ) / 2.0;
                double my = cy - ( from.getY1() + to.getY1() ) / 2.0;
                double cross = ( dx * my - dy * mx ) / len;
                double curvature = len == 0 ? 0 : -cross / len;
                m.put( "curvature", Math.round( curvature * 100 ) / 100.0 );
            }
            ts.add( m );
        }

        Map<String, Object> r = new LinkedHashMap<>();
        r.put( "states", ss );
        r.put( "transitions", ts );
        return r;

    }

    static List<String> charsToStrings( Iterable<Character> cs ) {
        List<String> r = new ArrayList<>();
        for ( Character c : cs ) {
            r.add( String.valueOf( c ) );
        }
        return r;
    }

    static String sha256( String s ) throws Exception {
        MessageDigest md = MessageDigest.getInstance( "SHA-256" );
        return HexFormat.of().formatHex( md.digest( s.getBytes( StandardCharsets.UTF_8 ) ) );
    }

    /* ------------------------------------------------------------------ */
    /* JSON (sem biblioteca): listas de valores simples ficam numa linha    */
    /* ------------------------------------------------------------------ */

    static void writeJson( Object v, StringBuilder sb, int indent ) {
        if ( v instanceof Map<?, ?> map ) {
            if ( map.isEmpty() ) {
                sb.append( "{}" );
                return;
            }
            sb.append( "{\n" );
            boolean first = true;
            for ( Map.Entry<?, ?> e : map.entrySet() ) {
                if ( !first ) {
                    sb.append( ",\n" );
                }
                first = false;
                pad( sb, indent + 1 );
                writeString( String.valueOf( e.getKey() ), sb );
                sb.append( ": " );
                writeJson( e.getValue(), sb, indent + 1 );
            }
            sb.append( '\n' );
            pad( sb, indent );
            sb.append( '}' );
        } else if ( v instanceof List<?> list ) {
            boolean simple = true;
            for ( Object o : list ) {
                if ( o instanceof Map || o instanceof List ) {
                    simple = false;
                    break;
                }
            }
            if ( simple ) {
                sb.append( '[' );
                for ( int i = 0; i < list.size(); i++ ) {
                    if ( i > 0 ) {
                        sb.append( ", " );
                    }
                    writeJson( list.get( i ), sb, indent );
                }
                sb.append( ']' );
            } else {
                sb.append( "[\n" );
                for ( int i = 0; i < list.size(); i++ ) {
                    if ( i > 0 ) {
                        sb.append( ",\n" );
                    }
                    pad( sb, indent + 1 );
                    writeJson( list.get( i ), sb, indent + 1 );
                }
                sb.append( '\n' );
                pad( sb, indent );
                sb.append( ']' );
            }
        } else if ( v instanceof String s ) {
            writeString( s, sb );
        } else {
            sb.append( v );
        }
    }

    static void pad( StringBuilder sb, int indent ) {
        sb.append( "  ".repeat( indent ) );
    }

    static void writeString( String s, StringBuilder sb ) {
        sb.append( '"' );
        for ( char c : s.toCharArray() ) {
            switch ( c ) {
                case '"' -> sb.append( "\\\"" );
                case '\\' -> sb.append( "\\\\" );
                case '\n' -> sb.append( "\\n" );
                case '\t' -> sb.append( "\\t" );
                default -> {
                    if ( c < 0x20 ) {
                        sb.append( String.format( "\\u%04x", (int) c ) );
                    } else {
                        sb.append( c );
                    }
                }
            }
        }
        sb.append( '"' );
    }

}
